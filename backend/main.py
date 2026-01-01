from fastapi import FastAPI, HTTPException, Request, Form, UploadFile, File, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from pymongo import MongoClient
from bson.objectid import ObjectId
from datetime import datetime
import shutil
import os
import mimetypes

# ==============================================================================
# 1. APPLICATION SETUP
# ==============================================================================

app = FastAPI(title="Online Course Portal API")

# Serve uploaded files statically
# Get the directory where this script is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")



app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)

# Database Connection
client = MongoClient("mongodb://localhost:27017/")
db = client["online_course_portal"]

# Collections
students_collection = db["students"]
admins_collection = db["admins"]
courses_collection = db["courses"]
reviews_collection = db["reviews"]
messages_collection = db["messages"]

# ==============================================================================
# 2. PYDANTIC MODELS
# ==============================================================================
class StudentRegister(BaseModel):
    full_name: str; email: EmailStr; password: str = Field(min_length=4); date_of_birth: str; gender: str; security_question: str; security_answer: str
class StudentLogin(BaseModel):
    email: EmailStr; password: str
class StudentLoginResponse(BaseModel):
    message: str; student_id: str; full_name: str; access_token: str
class StudentProfileUpdate(BaseModel):
    full_name: Optional[str] = None; email: Optional[EmailStr] = None; password: Optional[str] = None; date_of_birth: Optional[str] = None; gender: Optional[str] = None; security_question: Optional[str] = None; security_answer: Optional[str] = None
class MarkCompleteSchema(BaseModel):
    content_id: str
class AdminRegister(BaseModel):
    full_name: str; email: EmailStr; password: str; date_of_birth: str; gender: str; security_question: str; security_answer: str

class AdminLogin(BaseModel):
    email: EmailStr; password: str

class AdminProfileUpdate(BaseModel):
    full_name: Optional[str] = None; email: Optional[EmailStr] = None; password: Optional[str] = None; security_question: Optional[str] = None; security_answer: Optional[str] = None
class CourseSchema(BaseModel):
    title: str; description: str; youtubeLink: Optional[str] = None; created_at: datetime = Field(default_factory=datetime.utcnow)
class ReviewSchema(BaseModel):
    course_id: str; student_name: str; rating: int = Field(ge=1, le=5); comment: str; created_at: datetime = Field(default_factory=datetime.utcnow)
class AdminMessageSchema(BaseModel):
    student_id: str; message: str
class StudentMessageSchema(BaseModel):
    message: str

# ==============================================================================
# 3. AUTHENTICATION HELPERS
# ==============================================================================
async def get_current_student(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or "Bearer " not in auth_header: raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header.split(" ")[1]
    student = students_collection.find_one({"access_token": token})
    if not student: raise HTTPException(status_code=401, detail="Invalid token")
    return student

async def get_current_admin(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or "Bearer " not in auth_header: raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header.split(" ")[1]
    admin = admins_collection.find_one({"access_token": token})
    if not admin: raise HTTPException(status_code=401, detail="Invalid token")
    return admin

# ==============================================================================
# 4. STUDENT API ROUTES (REFINED)
# ==============================================================================
@app.post("/api/v1/student/register")
def register_student(data: StudentRegister):
    if students_collection.find_one({"email": data.email}): raise HTTPException(status_code=400, detail="Email already registered")
    result = students_collection.insert_one(data.dict())
    return {"message": "Student registered successfully", "id": str(result.inserted_id)}

@app.post("/api/v1/student/login", response_model=StudentLoginResponse)
def login_student(data: StudentLogin):
    student = students_collection.find_one({"email": data.email, "password": data.password})
    if not student: raise HTTPException(status_code=401, detail="Invalid email or password")
    token = f"fake-student-token-for-{student['_id']}"
    students_collection.update_one({"_id": student["_id"]}, {"$set": {"access_token": token}})
    return {"message": "Login successful", "student_id": str(student["_id"]), "full_name": student["full_name"], "access_token": token}

@app.get("/api/v1/student/profile")
async def get_student_profile(student: dict = Depends(get_current_student)):
    profile_data = student.copy()
    profile_data["_id"] = str(profile_data["_id"])
    if "access_token" in profile_data: del profile_data["access_token"]
    profile_data["enrolled_courses"] = [str(c) for c in profile_data.get("enrolled_courses", [])]
    return profile_data

@app.put("/api/v1/student/profile")
async def update_student_profile(update_data: StudentProfileUpdate, student: dict = Depends(get_current_student)):
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None and v.strip() != ""}
    if "email" in update_dict and update_dict["email"] != student["email"]:
        if students_collection.find_one({"email": update_dict["email"]}): raise HTTPException(status_code=400, detail="Email already in use")
    if update_dict: students_collection.update_one({"_id": student["_id"]}, {"$set": update_dict})
    return {"message": "Profile updated successfully"}

@app.delete("/api/v1/student/profile")
async def delete_student_account(student: dict = Depends(get_current_student)):
    students_collection.delete_one({"_id": student["_id"]}); return {"message": "Account deleted successfully"}

@app.get("/api/v1/student/dashboard-stats")
async def get_student_dashboard_stats(student: dict = Depends(get_current_student)):
    # Calculate completed courses based on progress = 100%
    enrolled_ids = student.get("enrolled_courses", [])
    student_progress = student.get("progress", {})
    completed_count = 0
    
    if enrolled_ids:
        courses = list(courses_collection.find({"_id": {"$in": enrolled_ids}}))
        for course in courses:
            course_id_str = str(course["_id"])
            total_content = len(course.get("course_content", []))
            completed_content_count = len(student_progress.get(course_id_str, []))
            if total_content > 0 and completed_content_count == total_content:
                completed_count += 1

    return {
        "total_courses_available": courses_collection.count_documents({}),
        "enrolled_courses_count": len(enrolled_ids),
        "completed_courses_count": completed_count
    }

@app.post("/api/v1/student/messages")
async def student_send_message_to_admin(data: StudentMessageSchema, student: dict = Depends(get_current_student)):
    message_doc = {"sender_id": student["_id"], "sender_type": "student", "recipient_type": "admin", "message": data.message, "timestamp": datetime.utcnow()}
    messages_collection.insert_one(message_doc); return {"message": "Message sent to admin successfully"}

@app.get("/api/v1/student/messages")
async def student_get_messages_from_admin(student: dict = Depends(get_current_student)):
    # Ensure we're comparing ObjectIds correctly
    student_id = student["_id"]
    # Query for messages where recipient_id matches student_id and sender is admin
    messages = list(messages_collection.find({
        "recipient_id": student_id, 
        "sender_type": "admin"
    }).sort("timestamp", -1))
    
    # Convert ObjectIds to strings for JSON serialization
    for msg in messages: 
        msg["_id"] = str(msg["_id"])
        if "sender_id" in msg:
            msg["sender_id"] = str(msg["sender_id"])
        if "recipient_id" in msg:
            msg["recipient_id"] = str(msg["recipient_id"])
        if "timestamp" in msg:
            msg["timestamp"] = str(msg["timestamp"])
    return {"messages": messages}

@app.get("/api/v1/student/enrolled-courses")
async def get_enrolled_courses(student: dict = Depends(get_current_student)):
    enrolled_ids = student.get("enrolled_courses", [])
    if not enrolled_ids: return []
    courses = list(courses_collection.find({"_id": {"$in": enrolled_ids}}, {"course_content": 0}))
    for course in courses: course["_id"] = str(course["_id"])
    return courses

@app.get("/api/v1/student/course/{course_id}")
async def get_single_course_content(course_id: str, student: dict = Depends(get_current_student)):
    enrolled_ids_str = [str(c) for c in student.get("enrolled_courses", [])]
    if course_id not in enrolled_ids_str: raise HTTPException(status_code=403, detail="Not enrolled in this course")
    
    course = courses_collection.find_one({"_id": ObjectId(course_id)})
    if not course: raise HTTPException(status_code=404, detail="Course not found")
        
    course["_id"] = str(course["_id"])
    if "course_content" in course:
        for item in course["course_content"]: 
            item["uploaded_at"] = str(item["uploaded_at"])
            # Fix file path to use forward slashes and ensure correct URL
            if item.get("type") == "file" and "path" in item:
                # Normalize path separators for cross-platform compatibility
                normalized_path = item["path"].replace("\\", "/")
                item["path"] = normalized_path
                # Store the download and view URLs
                content_id = item.get('content_id', '')
                item["download_url"] = f"/api/v1/student/course/{course_id}/download/{content_id}"
                item["view_url"] = f"/api/v1/student/course/{course_id}/view/{content_id}"
            elif item.get("type") == "youtube" and "url" in item:
                # Ensure YouTube URL is properly formatted
                youtube_url = item["url"]
                # If it's just a video ID, convert to full URL
                if len(youtube_url) == 11 and youtube_url.replace('-', '').replace('_', '').isalnum():
                    item["url"] = f"https://www.youtube.com/watch?v={youtube_url}"
    return course

@app.post("/api/v1/student/course/{course_id}/mark-complete")
async def mark_content_complete(course_id: str, data: MarkCompleteSchema, student: dict = Depends(get_current_student)):
    students_collection.update_one({"_id": student["_id"]}, {"$addToSet": {f"progress.{course_id}": data.content_id}})
    return {"message": "Progress updated"}

@app.get("/api/v1/student/course/{course_id}/download/{content_id}")
async def download_course_file(course_id: str, content_id: str, student: dict = Depends(get_current_student)):
    """Download course file with proper headers - always forces download"""
    # Verify enrollment
    enrolled_ids_str = [str(c) for c in student.get("enrolled_courses", [])]
    if course_id not in enrolled_ids_str: 
        raise HTTPException(status_code=403, detail="Not enrolled in this course")
    
    # Get course and find the content
    course = courses_collection.find_one({"_id": ObjectId(course_id)})
    if not course: 
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Find the content item
    content_item = None
    for item in course.get("course_content", []):
        if item.get("content_id") == content_id and item.get("type") == "file":
            content_item = item
            break
    
    if not content_item:
        raise HTTPException(status_code=404, detail="Content not found")
    
    file_path = content_item.get("path")
    if not file_path:
        raise HTTPException(status_code=404, detail="File path not found")
    
    # Normalize path and resolve to absolute path
    file_path = file_path.replace("\\", "/")
    # If path is relative, resolve it relative to BASE_DIR
    if not os.path.isabs(file_path):
        file_path = os.path.join(BASE_DIR, file_path)
    # Normalize the path (resolve .. and . components)
    file_path = os.path.normpath(file_path)
    
    # Security: Ensure the file is within the uploads directory
    if not file_path.startswith(os.path.normpath(UPLOADS_DIR)):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")
    
    # Get filename
    filename = content_item.get("name", os.path.basename(file_path))
    ext = os.path.splitext(filename)[1].lower()
    
    # Determine content type
    if ext == ".pdf":
        content_type = "application/pdf"
    elif ext in [".doc", ".docx"]:
        content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    else:
        content_type, _ = mimetypes.guess_type(file_path)
        if not content_type:
            content_type = "application/octet-stream"
    
    # Always force download for the download endpoint
    return FileResponse(
        file_path,
        media_type=content_type,
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@app.get("/api/v1/student/course/{course_id}/view/{content_id}")
async def view_course_file(course_id: str, content_id: str, student: dict = Depends(get_current_student)):
    """View course file (for PDF preview only - DOCX will be forced to download)"""
    # Verify enrollment
    enrolled_ids_str = [str(c) for c in student.get("enrolled_courses", [])]
    if course_id not in enrolled_ids_str: 
        raise HTTPException(status_code=403, detail="Not enrolled in this course")
    
    # Get course and find the content
    course = courses_collection.find_one({"_id": ObjectId(course_id)})
    if not course: 
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Find the content item
    content_item = None
    for item in course.get("course_content", []):
        if item.get("content_id") == content_id and item.get("type") == "file":
            content_item = item
            break
    
    if not content_item:
        raise HTTPException(status_code=404, detail="Content not found")
    
    file_path = content_item.get("path")
    if not file_path:
        raise HTTPException(status_code=404, detail="File path not found")
    
    # Normalize path and resolve to absolute path
    file_path = file_path.replace("\\", "/")
    # If path is relative, resolve it relative to BASE_DIR
    if not os.path.isabs(file_path):
        file_path = os.path.join(BASE_DIR, file_path)
    # Normalize the path (resolve .. and . components)
    file_path = os.path.normpath(file_path)
    
    # Security: Ensure the file is within the uploads directory
    if not file_path.startswith(os.path.normpath(UPLOADS_DIR)):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")
    
    # Get filename and content type
    filename = content_item.get("name", os.path.basename(file_path))
    ext = os.path.splitext(filename)[1].lower()
    
    # Determine content type
    if ext == ".pdf":
        content_type = "application/pdf"
    elif ext in [".doc", ".docx"]:
        content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    else:
        content_type, _ = mimetypes.guess_type(file_path)
        if not content_type:
            content_type = "application/octet-stream"
    
    # For DOCX files, force download (browsers cannot preview DOCX inline)
    if ext in [".doc", ".docx"]:
        return FileResponse(
            file_path,
            media_type=content_type,
            filename=filename,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    
    # For PDF files, allow inline viewing
    return FileResponse(
        file_path,
        media_type=content_type,
        filename=filename,
        headers={"Content-Disposition": f'inline; filename="{filename}"'}
    )

@app.get("/api/v1/student/progress")
async def get_student_progress(student: dict = Depends(get_current_student)):
    enrolled_ids = student.get("enrolled_courses", [])
    if not enrolled_ids: return []

    progress_data = []
    student_progress = student.get("progress", {})
    courses = list(courses_collection.find({"_id": {"$in": enrolled_ids}}))

    for course in courses:
        course_id_str = str(course["_id"])
        total_content = len(course.get("course_content", []))
        completed_content = len(student_progress.get(course_id_str, []))
        percentage = round((completed_content / total_content) * 100) if total_content > 0 else 0
        progress_data.append({"course_id": course_id_str, "course_title": course["title"], "percentage": percentage})
    return progress_data

# ==============================================================================
# 5. ADMIN API ROUTES (STABLE)
# ==============================================================================
@app.post("/api/v1/admin/register")
def register_admin(data: AdminRegister):
    if admins_collection.find_one({"email": data.email}): raise HTTPException(status_code=400, detail="Email already registered")
    admins_collection.insert_one(data.dict()); return {"message": "Admin registered successfully"}

@app.post("/api/v1/admin/login")
def login_admin(data: AdminLogin):
    admin = admins_collection.find_one({"email": data.email, "password": data.password})
    if not admin: raise HTTPException(status_code=401, detail="Invalid credentials")
    token = f"fake-admin-token-for-{admin['_id']}"; admins_collection.update_one({"_id": admin["_id"]}, {"$set": {"access_token": token}})
    return {"message": "Login successful", "admin_id": str(admin["_id"]), "full_name": admin["full_name"], "access_token": token}

@app.get("/api/v1/admin/profile")
async def get_admin_profile(admin: dict = Depends(get_current_admin)):
    admin_data = admin.copy(); admin_data["_id"] = str(admin_data["_id"])
    if "access_token" in admin_data: del admin_data["access_token"]
    return admin_data

@app.put("/api/v1/admin/profile")
async def update_admin_profile(update_data: AdminProfileUpdate, admin: dict = Depends(get_current_admin)):
    update_dict = update_data.dict(exclude_unset=True)
    update_dict = {k: v for k, v in update_dict.items() if v is not None and (not isinstance(v, str) or v.strip() != "")}
    
    print(f"DEBUG: Updating admin {admin['_id']} with {update_dict}")
    
    if update_dict:
        result = admins_collection.update_one({"_id": admin["_id"]}, {"$set": update_dict})
        print(f"DEBUG: Update result - matched: {result.matched_count}, modified: {result.modified_count}")
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Admin not found")
    return {"message": "Profile updated successfully"}

@app.delete("/api/v1/admin/delete")
async def delete_admin_account_by_admin(admin: dict = Depends(get_current_admin)):
    admins_collection.delete_one({"_id": admin["_id"]}); return {"message": "Admin account deleted successfully"}

@app.get("/api/v1/admin/dashboard-stats")
async def get_dashboard_stats(admin: dict = Depends(get_current_admin)):
    total_students = students_collection.count_documents({})
    total_courses = courses_collection.count_documents({})
    
    # Calculate unique students who have completed at least one course
    all_students = list(students_collection.find({}, {"enrolled_courses": 1, "progress": 1}))
    completed_students_count = 0
    
    # Get all courses to know content counts
    all_courses = {str(c["_id"]): len(c.get("course_content", [])) for c in courses_collection.find({}, {"course_content": 1})}
    
    for student in all_students:
        has_completed_any = False
        progress = student.get("progress", {})
        enrolled = student.get("enrolled_courses", [])
        
        for course_id in enrolled:
             course_id_str = str(course_id)
             # If course exists and has content
             if course_id_str in all_courses and all_courses[course_id_str] > 0:
                 # Check if completed count matches total content
                 if len(progress.get(course_id_str, [])) == all_courses[course_id_str]:
                     has_completed_any = True
                     break
        
        if has_completed_any:
            completed_students_count += 1

    trending_course = "N/A"
    pipeline = [{"$unwind": "$enrolled_courses"}, {"$group": {"_id": "$enrolled_courses", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 1}, {"$lookup": {"from": "courses", "localField": "_id", "foreignField": "_id", "as": "course_details"}}, {"$unwind": "$course_details"}]
    result = list(students_collection.aggregate(pipeline))
    if result: trending_course = result[0]["course_details"]["title"]
    
    return {"total_students": total_students, "completed_students": completed_students_count, "total_courses": total_courses, "trending_course": trending_course}

@app.get("/api/v1/admin/students/")
async def get_all_students(admin: dict = Depends(get_current_admin)):
    # Fetch all students and courses to perform manual join (avoids strict ObjectId type issues)
    students = list(students_collection.find({}, {"password": 0, "access_token": 0}))
    
    # Get all courses map: ID_STR -> {title, content_count}
    all_courses = {}
    for c in courses_collection.find({}, {"title": 1, "course_content": 1}):
        all_courses[str(c["_id"])] = {
            "title": c.get("title", "Unknown"),
            "content_count": len(c.get("course_content", []))
        }

    for student in students:
        student["_id"] = str(student["_id"])
        
        # Calculate Stats
        progress = student.get("progress", {})
        enrolled_ids = student.get("enrolled_courses", [])
        
        enrolled_titles = []
        completed_count = 0
        
        for c_id in enrolled_ids:
            c_str = str(c_id)
            if c_str in all_courses:
                course_data = all_courses[c_str]
                enrolled_titles.append(course_data["title"])
                
                # Check completion
                if course_data["content_count"] > 0:
                    student_completed_content = len(progress.get(c_str, []))
                    if student_completed_content == course_data["content_count"]:
                        completed_count += 1
        
        student["enrolled_course_titles"] = enrolled_titles
        student["completed_courses_count"] = completed_count
        student["total_enrolled_count"] = len(enrolled_ids) # Helper for frontend status
        
        # Cleanup
        if "progress" in student: del student["progress"]
        if "enrolled_courses" in student: del student["enrolled_courses"]

    return students

@app.delete("/api/v1/admin/students/{student_id}")
async def delete_student_by_admin(student_id: str, admin: dict = Depends(get_current_admin)):
    students_collection.delete_one({"_id": ObjectId(student_id)}); return {"message": "Student deleted successfully"}

@app.post("/api/v1/admin/students/{student_id}/allow-certificate")
async def allow_certificate(student_id: str, course_id: str = Form(...), admin: dict = Depends(get_current_admin)):
    course = courses_collection.find_one({"_id": ObjectId(course_id)})
    if not course: raise HTTPException(status_code=404, detail="Course not found")
    students_collection.update_one({"_id": ObjectId(student_id)}, {"$set": {"certificate_allowed": True, "status": "Completed"}, "$push": {"certificates": {"course_id": course_id, "course_name": course["title"], "issued_date": datetime.utcnow()}}})
    return {"message": "Certificate access granted"}

@app.get("/api/v1/student/certificates")
async def get_student_certificates(student: dict = Depends(get_current_student)):
    certificates = student.get("certificates", [])
    for cert in certificates: cert["issued_date"] = str(cert["issued_date"])
    return {"certificates": certificates}

@app.post("/api/v1/admin/messages")
async def send_message_to_student(data: AdminMessageSchema, admin: dict = Depends(get_current_admin)):
    student_obj_id = ObjectId(data.student_id)
    if not students_collection.find_one({"_id": student_obj_id}): raise HTTPException(status_code=404, detail="Student not found.")
    message_doc = {"sender_id": admin["_id"], "sender_type": "admin", "recipient_id": student_obj_id, "recipient_type": "student", "message": data.message, "timestamp": datetime.utcnow()}
    messages_collection.insert_one(message_doc); return {"message": "Message sent successfully"}

@app.get("/api/v1/admin/messages")
async def get_admin_messages(admin: dict = Depends(get_current_admin)):
    pipeline = [{"$match": {"sender_type": "student"}}, {"$lookup": {"from": "students", "localField": "sender_id", "foreignField": "_id", "as": "student_info"}}, {"$unwind": "$student_info"}, {"$sort": {"timestamp": -1}}, {"$project": {"_id": 0, "message_id": {"$toString": "$_id"}, "student_name": "$student_info.full_name", "message": "$message", "timestamp": "$timestamp"}}]
    return list(messages_collection.aggregate(pipeline))

@app.get("/api/v1/admin/reviews/")
async def get_all_reviews(admin: dict = Depends(get_current_admin)):
    pipeline = [{"$sort": {"created_at": -1}}, {"$lookup": {"from": "courses", "localField": "course_id", "foreignField": "_id", "as": "course_info"}}, {"$unwind": {"path": "$course_info", "preserveNullAndEmptyArrays": True}}, {"$project": {"_id": {"$toString": "$_id"}, "course_title": "$course_info.title", "student_name": "$student_name", "rating": "$rating", "comment": "$comment", "created_at": "$created_at"}}]
    return list(reviews_collection.aggregate(pipeline))

# ==============================================================================
# 6. COURSE & CONTENT MANAGEMENT ROUTES (STABLE)
# ==============================================================================
@app.get("/api/v1/admin/courses/")
async def get_all_courses_for_admin(admin: dict = Depends(get_current_admin)):
    courses = list(courses_collection.find())
    for c in courses:
        c["_id"] = str(c["_id"])
        c["course_content"] = c.get("course_content", [])
    return courses

@app.get("/api/v1/courses/")
async def get_all_courses_for_student(student: dict = Depends(get_current_student)):
    courses = list(courses_collection.find({}, {"course_content": 0, "file_path": 0}))
    for c in courses: c["_id"] = str(c["_id"])
    return courses

@app.post("/api/v1/student/enroll/{course_id}")
async def enroll_in_course(course_id: str, student: dict = Depends(get_current_student)):
    obj_course_id = ObjectId(course_id)
    if not courses_collection.find_one({"_id": obj_course_id}): raise HTTPException(status_code=404, detail="Course not found.")
    enrolled_ids_str = [str(c) for c in student.get("enrolled_courses", [])]
    if course_id in enrolled_ids_str: raise HTTPException(status_code=400, detail="Already enrolled.")
    students_collection.update_one({"_id": student["_id"]}, {"$addToSet": {"enrolled_courses": obj_course_id}})
    return {"message": "Successfully enrolled."}

@app.post("/api/v1/courses/no-file/")
async def create_course_text_only(data: CourseSchema, admin: dict = Depends(get_current_admin)):
    result = courses_collection.insert_one(data.dict())
    return {"message": "Course created successfully!", "course_id": str(result.inserted_id)}

@app.post("/api/v1/admin/upload")
async def upload_course_content(admin: dict = Depends(get_current_admin), course_id: str = Form(...), content: Optional[UploadFile] = File(None), youtube_link_upload: Optional[str] = Form(None)):
    if not (content and content.filename) and not youtube_link_upload: raise HTTPException(status_code=400, detail="File or YouTube link must be provided.")
    obj_course_id = ObjectId(course_id)
    if not courses_collection.find_one({"_id": obj_course_id}): raise HTTPException(status_code=404, detail="Course not found.")
    
    content_id = str(ObjectId())
    update_data = {}
    if content and content.filename:
        safe_filename = "".join(c for c in content.filename if c.isalnum() or c in ('.', '_', '-', ' ')).strip()
        # Use absolute path for file storage
        file_path = os.path.join(UPLOADS_DIR, f"{course_id}_{safe_filename}")
        with open(file_path, "wb") as buffer: shutil.copyfileobj(content.file, buffer)
        # Store relative path in database for portability (will be resolved to absolute when needed)
        db_path = os.path.join("uploads", f"{course_id}_{safe_filename}").replace("\\", "/")
        update_data = {"type": "file", "path": db_path, "name": safe_filename, "content_id": content_id}
    elif youtube_link_upload:
        update_data = {"type": "youtube", "url": youtube_link_upload, "content_id": content_id}

    if update_data: courses_collection.update_one({"_id": obj_course_id}, {"$push": {"course_content": {**update_data, "uploaded_at": datetime.utcnow()}}})
    return {"message": "Content uploaded successfully"}

@app.delete("/api/v1/admin/courses/{course_id}")
async def delete_course(course_id: str, admin: dict = Depends(get_current_admin)):
    courses_collection.delete_one({"_id": ObjectId(course_id)}); return {"message": "Course deleted successfully"}

@app.post("/api/v1/reviews/")
async def submit_review(data: ReviewSchema, student: dict = Depends(get_current_student)):
    review_data = data.dict(); review_data["course_id"] = ObjectId(data.course_id); review_data["student_id"] = student["_id"]
    result = reviews_collection.insert_one(review_data)
    return {"message": "Review submitted", "review_id": str(result.inserted_id)}

# Serve Frontend Static Files (Fix for Video Embeds Error 153)
# Moved to end to avoid shadowing API routes
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")