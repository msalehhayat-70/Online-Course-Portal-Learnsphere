document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        document.body.innerHTML = '<div style="text-align:center; padding: 50px;"><h1>Access Denied</h1><p>Please log in as an Admin.</p><a href="02_role_selection.html">Go to Login</a></div>';
        return;
    }
    const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';
    let adminProfileData = {};

    const getAuthHeaders = (isFormData = false) => {
        const headers = { 'Authorization': `Bearer ${token}` };
        if (!isFormData) headers['Content-Type'] = 'application/json';
        return headers;
    };
    function showModal(type, title, message, onConfirm) {
        const modal = document.getElementById('custom-modal'), actions = modal.querySelector('.modal-actions');
        modal.querySelector('#modal-title').textContent = title;
        modal.querySelector('#modal-message').textContent = message;
        const icon = modal.querySelector('#modal-icon');
        icon.className = 'modal-icon fas';

        // Modal styling based on type
        if (type === 'success') icon.classList.add('fa-check-circle', 'success');
        else if (type === 'error') icon.classList.add('fa-times-circle', 'error');
        else if (type === 'confirm') icon.classList.add('fa-exclamation-triangle', 'warning'); // Yellow warning for generic confirm
        else if (type === 'danger') icon.classList.add('fa-exclamation-triangle', 'danger');   // Red alert for danger

        actions.innerHTML = '';

        if ((type === 'confirm' || type === 'danger') && onConfirm) {
            const confirmBtn = document.createElement('button');
            confirmBtn.className = type === 'danger' ? 'btn btn-danger' : 'btn'; // Red button for danger
            confirmBtn.textContent = 'Confirm';
            confirmBtn.onclick = () => { hideModal(); onConfirm(); };

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.onclick = hideModal;

            actions.append(confirmBtn, cancelBtn);
        } else {
            const okBtn = document.createElement('button');
            okBtn.className = 'btn';
            okBtn.textContent = 'OK';
            okBtn.onclick = hideModal;
            actions.appendChild(okBtn);
        }
        modal.style.display = 'flex';
    }
    function hideModal() { document.getElementById('custom-modal').style.display = 'none'; }

    const renderers = {
        'dashboard-section': async () => {
            const section = document.getElementById('dashboard-section');
            section.innerHTML = `<h2>Dashboard</h2>
                <div class="stats-container">
                    <div class="stat-card"><i class="fas fa-users"></i><h3>Total Students</h3><p id="total-students">...</p></div>
                    <div class="stat-card"><i class="fas fa-user-graduate"></i><h3>Completed Students</h3><p id="completed-students">...</p></div>
                    <div class="stat-card"><i class="fas fa-book-open"></i><h3>Total Courses</h3><p id="total-courses">...</p></div>
                    <div class="stat-card"><i class="fas fa-chart-line"></i><h3>Trending Course</h3><p id="trending-course" style="font-size: 1.5rem;">...</p></div>
                </div>`;
            try {
                const res = await fetch(`${API_BASE_URL}/admin/dashboard-stats`, { headers: getAuthHeaders() });
                if (!res.ok) throw new Error('Failed to load stats');
                const stats = await res.json();
                document.getElementById('total-students').textContent = stats.total_students;
                document.getElementById('completed-students').textContent = stats.completed_students;
                document.getElementById('total-courses').textContent = stats.total_courses;
                document.getElementById('trending-course').textContent = stats.trending_course;
            } catch (err) { section.innerHTML += `<p style="color:red">Failed to load dashboard stats.</p>`; }
        },
        'profile-section': async () => {
            const section = document.getElementById('profile-section');
            section.innerHTML = `<h2>My Profile</h2><p>Loading profile...</p>`;
            try {
                const res = await fetch(`${API_BASE_URL}/admin/profile`, { headers: getAuthHeaders() });
                if (!res.ok) throw new Error('Failed to load profile');
                adminProfileData = await res.json();

                section.innerHTML = `<h2>My Profile</h2>
                    <div id="profile-view" class="profile-card">
                         <div class="profile-group">
                            <span class="profile-label">Full Name:</span>
                            <span class="profile-value">${adminProfileData.full_name || ''}</span>
                        </div>
                        <div class="profile-group">
                            <span class="profile-label">Email Address:</span>
                            <span class="profile-value">${adminProfileData.email || ''}</span>
                        </div>
                        <div class="profile-group">
                            <span class="profile-label">Password:</span>
                            <span class="profile-value">${adminProfileData.password || ''}</span>
                        </div>
                        <div class="profile-group">
                            <span class="profile-label">Security Question:</span>
                            <span class="profile-value">${adminProfileData.security_question || ''}</span>
                        </div>
                         <div class="profile-group">
                            <span class="profile-label">Security Answer:</span>
                            <span class="profile-value">${adminProfileData.security_answer || ''}</span>
                        </div>
                        
                        <div style="margin-top:30px;">
                            <button class="btn" data-action="show-edit-profile"><i class="fas fa-edit"></i> Edit Profile</button>
                            <button class="btn btn-danger" data-action="delete-account" style="margin-left:10px;"><i class="fas fa-trash-alt"></i> Delete Account</button>
                        </div>
                    </div>
                    <form id="profile-edit-form" style="display:none;" class="profile-card">
                        <h3 style="margin-bottom:20px; color:var(--dark-blue);">Edit Your Information</h3>
                        <div class="form-group" style="margin-bottom:15px;">
                            <label style="display:block; font-weight:bold; margin-bottom:5px;">Full Name:</label>
                            <input type="text" id="edit-name" class="form-control" style="width:100%; padding:10px;" required>
                        </div>
                        <div class="form-group" style="margin-bottom:15px;">
                            <label style="display:block; font-weight:bold; margin-bottom:5px;">Email:</label>
                            <input type="email" id="edit-email" class="form-control" style="width:100%; padding:10px;" required>
                        </div>
                        <div class="form-group" style="margin-bottom:15px;">
                            <label style="display:block; font-weight:bold; margin-bottom:5px;">Password:</label>
                            <input type="text" id="edit-password" class="form-control" style="width:100%; padding:10px;" required>
                        </div>
                        <div class="form-group" style="margin-bottom:15px;">
                            <label style="display:block; font-weight:bold; margin-bottom:5px;">Security Question:</label>
                            <input type="text" id="edit-sec-q" class="form-control" style="width:100%; padding:10px;" required>
                        </div>
                        <div class="form-group" style="margin-bottom:25px;">
                            <label style="display:block; font-weight:bold; margin-bottom:5px;">Security Answer:</label>
                            <input type="text" id="edit-sec-a" class="form-control" style="width:100%; padding:10px;" required>
                        </div>
                        <div style="text-align:right;">
                            <button type="button" class="btn btn-secondary" data-action="cancel-edit" style="margin-right:10px;"><i class="fas fa-times"></i> Cancel</button>
                            <button type="submit" class="btn"><i class="fas fa-save"></i> Save Changes</button>
                        </div>
                    </form>`;
            } catch (err) { section.innerHTML = `<p style="color:red">Could not load profile.</p>` }
        },
        'manage-courses-section': async () => {
            const section = document.getElementById('manage-courses-section');
            section.innerHTML = `<h2>Manage Courses</h2>
                <button class="btn" data-action="show-create-course"><i class="fas fa-plus"></i> Create New Course</button>
                
                <div id="course-form-container" style="display:none;">
                    <form id="course-form" class="create-course-form">
                        <h3 style="margin-bottom:15px; color:var(--dark-blue);">New Course Details</h3>
                        <div>
                            <label style="font-weight:bold; display:block; margin-bottom:5px;">Course Title</label>
                            <input type="text" name="title" placeholder="e.g. Introduction to Web Development" required>
                        </div>
                        <div>
                            <label style="font-weight:bold; display:block; margin-bottom:5px;">Description</label>
                            <textarea name="description" placeholder="Course summary and objectives..." required></textarea>
                        </div>
                        <div>
                            <label style="font-weight:bold; display:block; margin-bottom:5px;">YouTube Intro Link (Optional)</label>
                            <input type="text" name="youtubeLink" placeholder="https://youtube.com/...">
                        </div>
                        <div style="text-align:right;">
                            <button type="button" class="btn btn-secondary" data-action="cancel-create-course" style="margin-right:10px;">Cancel</button>
                            <button type="submit" class="btn">Create Course</button>
                        </div>
                    </form>
                </div>
                
                <h3 style="margin-top:40px; border-top:2px solid var(--bg-color); padding-top:20px;">Existing Courses</h3>
                <table class="table"><thead><tr><th style="width:20%">Title</th><th style="width:35%">Description</th><th style="width:30%">Content</th><th style="width:15%">Actions</th></tr></thead><tbody id="courses-list-body"></tbody></table>`;
            try {
                const response = await fetch(`${API_BASE_URL}/admin/courses/`, { headers: getAuthHeaders() });
                const courses = await response.json();
                const tableBody = document.getElementById('courses-list-body');
                tableBody.innerHTML = courses.length ? '' : '<tr><td colspan="4" style="text-align:center;">No courses found.</td></tr>';
                courses.forEach(course => {
                    const contentHtml = course.course_content.map(content =>
                        `<li><i class="fas ${content.type === 'file' ? 'fa-file-alt' : 'fa-video'}"></i> ${content.type === 'file' ? (content.path.split(/[\\/]/).pop()) : 'YouTube Link'}</li>`
                    ).join('');
                    tableBody.insertAdjacentHTML('beforeend', `
                        <tr>
                            <td>${course.title}</td><td>${course.description}</td>
                            <td><ul class="course-content-list">${contentHtml || 'No content yet'}</ul></td>
                            <td class="action-buttons"><button class="btn btn-danger" data-action="delete-course" data-id="${course._id}">Delete</button></td>
                        </tr>`);
                });
            } catch (error) { console.error("Error loading courses:", error); }
        },
        'upload-section': async () => {
            const section = document.getElementById('upload-section');
            section.innerHTML = `<h2><i class="fas fa-cloud-upload-alt"></i> Upload Course Content</h2>
                <div class="upload-card">
                    <form id="upload-content-form">
                        <div class="upload-input-group">
                            <label><i class="fas fa-book"></i> 1. Select Course</label>
                            <select id="course-select" name="course_id" required class="form-control">
                                <option value="">-- Choose a Course --</option>
                            </select>
                        </div>
                        
                        <div class="upload-divider"><span>THEN CHOOSE CONTENT SOURCE</span></div>

                        <div class="upload-container">
                            <div class="upload-input-group">
                                <label><i class="fas fa-file-alt"></i> Option A: Upload a File (PDF, DOCX)</label>
                                <input type="file" name="content" style="background: #f9f9f9; border: 1px dashed #ccc;">
                            </div>
                            
                            <div style="text-align:center; color:#888; font-weight:bold;">- OR -</div>

                            <div class="upload-input-group">
                                <label><i class="fab fa-youtube"></i> Option B: Paste YouTube Link</label>
                                <input type="text" name="youtube_link_upload" placeholder="https://www.youtube.com/watch?v=...">
                            </div>
                        </div>

                        <div style="margin-top: 40px;">
                            <button type="submit" class="btn" style="width: 100%; padding: 15px; font-size: 1.2rem;"><i class="fas fa-upload"></i> Upload Content</button>
                        </div>
                    </form>
                </div>`;
            try {
                const response = await fetch(`${API_BASE_URL}/admin/courses/`, { headers: getAuthHeaders() });
                const courses = await response.json();
                const courseSelect = document.getElementById('course-select');
                courses.forEach(course => courseSelect.add(new Option(course.title, course._id)));
            } catch (error) { console.error(error); }
        },
        'view-students-section': async () => {
            const section = document.getElementById('view-students-section');
            section.innerHTML = `<h2>View Students</h2>
                <table class="table">
                    <thead><tr><th style="width:20%">Name</th><th style="width:25%">Email</th><th style="width:25%">Courses Enrolled</th><th style="width:15%">Status</th><th style="width:15%">Actions</th></tr></thead>
                    <tbody id="students-table-body"></tbody>
                </table>`;
            try {
                const response = await fetch(`${API_BASE_URL}/admin/students/`, { headers: getAuthHeaders() });
                if (!response.ok) throw new Error('Failed to fetch students');
                const students = await response.json();
                const tableBody = document.getElementById('students-table-body');
                tableBody.innerHTML = '';
                if (students.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No students have registered yet.</td></tr>';
                } else {
                    students.forEach(student => {
                        const enrolledCoursesHtml = student.enrolled_course_titles && student.enrolled_course_titles.length > 0
                            ? student.enrolled_course_titles.join('<br>')
                            : 'No courses enrolled';
                        tableBody.insertAdjacentHTML('beforeend', `
                            <tr>
                                <td>${student.full_name || 'N/A'}</td>
                                <td>${student.email || 'N/A'}</td>
                                <td>${enrolledCoursesHtml}</td>
                                <td style="text-align:center;">
                                    ${(student.completed_courses_count > 0 && student.total_enrolled_count > 0 && student.completed_courses_count === student.total_enrolled_count) ? '<span class="status-badge success">Completed</span>' : '<span class="status-badge warning">In Progress</span>'}
                                </td>
                                <td class="action-buttons">
                                    <button class="btn btn-danger" data-action="delete-student" data-id="${student._id}">Delete</button>
                                </td>
                            </tr>`);
                    });
                }
            } catch (error) {
                document.getElementById('students-table-body').innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">Could not load student data. Please check the server.</td></tr>';
            }
        },
        'messages-section': async () => {
            const section = document.getElementById('messages-section');
            section.innerHTML = `<h2>Messages</h2>
                <div class="message-form-wrapper">
                    <h3 style="margin-bottom: 20px;"><i class="fas fa-paper-plane"></i> Send a Message</h3>
                    <form id="send-message-form">
                        <div class="form-group">
                            <label for="message-student-select">To Student:</label>
                            <select id="message-student-select" required><option value="">Loading students...</option></select>
                        </div>
                        <div class="form-group">
                            <label for="message-text">Message:</label>
                            <textarea id="message-text" rows="5" required placeholder="Type your message here..." style="resize: vertical;"></textarea>
                        </div>
                        <div style="text-align: right;">
                            <button type="submit" class="btn">Send Message</button>
                        </div>
                    </form>
                </div>
                <div style="margin-top:40px;">
                    <h3><i class="fas fa-inbox"></i> Inbox</h3>
                    <div id="received-messages-container" style="margin-top: 15px;"><p>Loading messages...</p></div>
                </div>`;
            try {
                const res = await fetch(`${API_BASE_URL}/admin/students/`, { headers: getAuthHeaders() });
                if (!res.ok) throw new Error('Could not load students');
                const students = await res.json();
                const select = document.getElementById('message-student-select');
                select.innerHTML = '<option value="">-- Select a Student --</option>';
                students.forEach(s => select.add(new Option(`${s.full_name} (${s.email})`, s._id)));
            } catch (err) {
                document.getElementById('message-student-select').innerHTML = '<option>Could not load students</option>';
            }
            try {
                const res = await fetch(`${API_BASE_URL}/admin/messages`, { headers: getAuthHeaders() });
                if (!res.ok) throw new Error('Could not load messages');
                const messages = await res.json();
                const container = document.getElementById('received-messages-container');
                container.innerHTML = messages.length ? '' : '<p>No messages received yet.</p>';
                messages.forEach(msg => {
                    container.insertAdjacentHTML('beforeend', `<div class="message-card">
                        <div class="message-card-header"><span>From: ${msg.student_name}</span><span class="timestamp">${new Date(msg.timestamp).toLocaleString()}</span></div>
                        <p>${msg.message}</p></div>`);
                });
            } catch (err) {
                document.getElementById('received-messages-container').innerHTML = '<p style="color:red">Could not load messages.</p>';
            }
        },
        'reviews-section': async () => {
            const section = document.getElementById('reviews-section');
            section.innerHTML = `<h2>Student Reviews</h2><div id="reviews-container" class="reviews-grid"><p>Loading reviews...</p></div>`;
            try {
                const response = await fetch(`${API_BASE_URL}/admin/reviews/`, { headers: getAuthHeaders() });
                const reviews = await response.json();
                const container = document.getElementById('reviews-container');
                container.innerHTML = reviews.length ? '' : '<p>No reviews submitted yet.</p>';
                reviews.forEach(review => {
                    const stars = '<i class="fas fa-star"></i>'.repeat(review.rating);
                    const emptyStars = '<i class="far fa-star"></i>'.repeat(5 - review.rating);
                    container.insertAdjacentHTML('beforeend', `
                        <div class="review-card">
                            <div class="review-card-header">
                                <div>
                                    <span class="review-author">${review.student_name}</span>
                                    <span class="review-course">on ${review.course_title || 'Unknown Course'}</span>
                                </div>
                                <span class="rating-stars">${stars}${emptyStars}</span>
                            </div>
                            <p style="color: #444; font-style: italic;">"${review.comment}"</p>
                            <small class="timestamp">${new Date(review.created_at).toLocaleDateString()} ${new Date(review.created_at).toLocaleTimeString()}</small>
                        </div>`);
                });
            } catch (error) { document.getElementById('reviews-container').innerHTML = `<p style="color:red">Could not load reviews.</p>`; }
        }
    };

    document.getElementById('main-content-area').addEventListener('click', async (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        const id = target.dataset.id;
        if (action === "show-edit-profile") {
            document.getElementById('profile-view').style.display = 'none';
            document.getElementById('profile-edit-form').style.display = 'block';
            document.getElementById('edit-name').value = adminProfileData.full_name || '';
            document.getElementById('edit-email').value = adminProfileData.email || '';
            document.getElementById('edit-password').value = adminProfileData.password || '';
            document.getElementById('edit-sec-q').value = adminProfileData.security_question || '';
            document.getElementById('edit-sec-a').value = adminProfileData.security_answer || '';
        }
        if (action === "cancel-edit") {
            document.getElementById('profile-view').style.display = 'block';
            document.getElementById('profile-edit-form').style.display = 'none';
        }
        if (action === "delete-account") {
            showModal('danger', 'Delete Your Account', 'This is permanent and cannot be undone. Are you sure you want to delete your account?', () => {
                fetch(`${API_BASE_URL}/admin/delete`, { method: 'DELETE', headers: getAuthHeaders() })
                    .then(res => { if (!res.ok) throw new Error(); showModal('success', 'Account Deleted', 'Your account has been removed.'); localStorage.clear(); setTimeout(() => window.location.href = '02_role_selection.html', 2000); })
                    .catch(() => showModal('error', 'Failed', 'Could not delete account.'));
            });
        }
        if (action === "show-create-course") document.getElementById('course-form-container').style.display = 'block';
        if (action === "cancel-create-course") document.getElementById('course-form-container').style.display = 'none';
        if (action === "delete-course") {
            showModal('danger', 'Delete Course', 'Are you sure you want to delete this course? All associated content will be lost.', () => {
                fetch(`${API_BASE_URL}/admin/courses/${id}`, { method: 'DELETE', headers: getAuthHeaders() })
                    .then(res => { if (!res.ok) throw new Error(); showModal('success', 'Deleted!', 'Course has been removed.'); renderers['manage-courses-section'](); })
                    .catch(() => showModal('error', 'Error', 'Could not delete course.'));
            });
        }
        if (action === "delete-student") {
            showModal('danger', 'Delete Student', 'Are you sure you want to remove this student account?', () => {
                fetch(`${API_BASE_URL}/admin/students/${id}`, { method: 'DELETE', headers: getAuthHeaders() })
                    .then(res => { if (!res.ok) throw new Error(); showModal('success', 'Deleted'); renderers['view-students-section'](); })
                    .catch(() => showModal('error', 'Error', 'Could not delete student.'));
            });
        }
        // FIX: Added course selection logic for certificates
        if (action === "allow-cert") {
            fetch(`${API_BASE_URL}/admin/courses/`, { headers: getAuthHeaders() })
                .then(res => res.json())
                .then(courses => {
                    if (courses.length === 0) { showModal('error', 'No Courses', 'Please create a course first.'); return; }
                    let courseList = 'Available courses:\n\n';
                    courses.forEach((c, index) => { courseList += `${index + 1}. ${c.title}\n`; });
                    courseList += '\nEnter course number:';
                    const courseNum = prompt(courseList);
                    if (!courseNum) return;
                    const courseIndex = parseInt(courseNum) - 1;
                    if (courseIndex < 0 || courseIndex >= courses.length) { showModal('error', 'Invalid', 'Invalid course number.'); return; }
                    const selectedCourse = courses[courseIndex];
                    const formData = new FormData();
                    formData.append('course_id', selectedCourse._id);
                    fetch(`${API_BASE_URL}/admin/students/${id}/allow-certificate`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData })
                        .then(res => { if (!res.ok) throw new Error(); showModal('success', 'Success', `Certificate granted for ${selectedCourse.title}`); target.disabled = true; target.textContent = 'Allowed'; })
                        .catch(() => showModal('error', 'Error', 'Action failed.'));
                })
                .catch(() => showModal('error', 'Error', 'Could not load courses.'));
        }
    });

    document.getElementById('main-content-area').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (e.target.id === 'profile-edit-form') {
            const payload = {
                full_name: document.getElementById('edit-name').value,
                email: document.getElementById('edit-email').value,
                password: document.getElementById('edit-password').value,
                security_question: document.getElementById('edit-sec-q').value,
                security_answer: document.getElementById('edit-sec-a').value
            };
            try {
                const response = await fetch(`${API_BASE_URL}/admin/profile`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(payload) });
                if (!response.ok) throw new Error((await response.json()).detail);
                showModal('success', 'Profile Updated', 'Your information has been saved.');
                renderers['profile-section']();
            } catch (error) { showModal('error', 'Error', `Could not update profile: ${error.message}`); }
        }
        if (e.target.id === 'send-message-form') {
            const studentId = document.getElementById('message-student-select').value;
            const message = document.getElementById('message-text').value;
            if (!studentId) return showModal('error', 'Invalid Input', 'Please select a student.');
            if (!message.trim()) return showModal('error', 'Invalid Input', 'Message cannot be empty.');
            const payload = { student_id: studentId, message: message };
            try {
                const response = await fetch(`${API_BASE_URL}/admin/messages`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
                if (!response.ok) throw new Error((await response.json()).detail);
                showModal('success', 'Message Sent', 'Your message was sent successfully.');
                e.target.reset();
            } catch (error) { showModal('error', 'Send Error', `Could not send message: ${error.message}`); }
        }
        if (e.target.id === 'course-form') {
            const formData = new FormData(e.target);
            try {
                const response = await fetch(`${API_BASE_URL}/courses/no-file/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(Object.fromEntries(formData)) });
                if (!response.ok) throw new Error((await response.json()).detail);
                showModal('success', 'Course Created', 'The new course has been added.');
                e.target.reset(); document.getElementById('course-form-container').style.display = 'none';
                renderers['manage-courses-section']();
            } catch (error) { showModal('error', 'Error', `Failed to create course: ${error.message}`); }
        }
        if (e.target.id === 'upload-content-form') {
            const formData = new FormData(e.target);
            if (!formData.get('course_id')) return showModal('error', 'Error', 'Please select a course.');
            try {
                const response = await fetch(`${API_BASE_URL}/admin/upload`, { method: 'POST', headers: getAuthHeaders(true), body: formData });
                if (!response.ok) throw new Error((await response.json()).detail);
                showModal('success', 'Upload Success', 'Content uploaded successfully.');
                e.target.reset();
            } catch (error) { showModal('error', 'Upload Failed', `Could not upload content: ${error.message}`); }
        }
    });

    const renderSection = (sectionId) => {
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(sectionId)?.classList.add('active');
        renderers[sectionId]?.();
    };

    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            if (link.id === 'nav-logout') {
                showModal('confirm', 'Logout', 'Are you sure?', () => { localStorage.clear(); window.location.href = '02_role_selection.html'; });
                return;
            }
            document.querySelectorAll('.sidebar-nav a').forEach(nav => nav.classList.remove('active'));
            link.classList.add('active');
            renderSection(link.dataset.section);
        });
    });

    renderSection('dashboard-section');
});
