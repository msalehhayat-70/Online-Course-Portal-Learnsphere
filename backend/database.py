from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

# Database connection logic
MONGO_URI = "mongodb://localhost:27017/"
client = None  # Start with client as None

try:
    # Try to connect to the server
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)  # 5 second timeout
    client.admin.command('ismaster')
    print("✅ MongoDB Connection Successful! Server is running.")

except ConnectionFailure as e:
    print(f"❌ MongoDB Connection Failed! Error: {e}")
    print("--- Please make sure the MongoDB server is running on your computer. ---")
    client = None  # Set client to None if connection fails

# Database and collections setup
if client:
    db = client.leransphere  # 👈 Changed here
    student_collection = db["students"]
    admin_collection = db["admins"]
    course_collection = db["courses"]
    review_collection = db["reviews"]
else:
    print("--- Database collections could not be initialized. ---")
    db = None
    student_collection = None
    admin_collection = None
    course_collection = None
    review_collection = None
