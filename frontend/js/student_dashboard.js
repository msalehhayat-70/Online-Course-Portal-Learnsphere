document.addEventListener('DOMContentLoaded', () => {
    const userToken = localStorage.getItem('userToken');
    if (!userToken) {
        document.body.innerHTML = `<div style="text-align: center; padding: 50px; font-size: 1.2rem;"><h1>Access Denied</h1><p>You are not logged in. Please log in to access the dashboard.</p><a href="04_student_login.html">Go to Login</a></div>`;
        return;
    }

    const API_BASE_URL = 'http://127.0.0.1:8000';
    let studentProfileData = {};
    let allCoursesCache = [];

    const getAuthHeaders = () => ({ 'Authorization': `Bearer ${userToken}`, 'Content-Type': 'application/json' });

    function showModal(type, title, message, onConfirmCallback = null) {
        const modal = document.getElementById('custom-modal'),
            modalIcon = document.getElementById('modal-icon'),
            modalTitle = document.getElementById('modal-title'),
            modalMessage = document.getElementById('modal-message'),
            modalActions = document.querySelector('#custom-modal .modal-actions');
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalIcon.className = 'modal-icon fas';
        modalActions.innerHTML = '';

        if (type === 'success') modalIcon.classList.add('fa-check-circle', 'success');
        else if (type === 'error') modalIcon.classList.add('fa-times-circle', 'error');
        else if (type === 'confirm') modalIcon.classList.add('fa-question-circle', 'confirm');

        if (type === 'confirm' && typeof onConfirmCallback === 'function') {
            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'btn';
            confirmBtn.textContent = 'Confirm';
            confirmBtn.onclick = () => { hideModal(); onConfirmCallback(); };
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.onclick = hideModal;
            modalActions.append(confirmBtn, cancelBtn);
        } else {
            const okBtn = document.createElement('button');
            okBtn.className = 'btn';
            okBtn.textContent = 'OK';
            okBtn.onclick = hideModal;
            modalActions.appendChild(okBtn);
        }
        modal.style.display = 'flex';
    }

    window.hideModal = () => document.getElementById('custom-modal').style.display = 'none';

    function showVideoModal(youtubeUrl) {
        if (!youtubeUrl || !youtubeUrl.trim()) {
            showModal('error', 'Invalid URL', 'No YouTube URL provided.');
            return;
        }

        let videoId = null;
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^#&?]*).*/,
            /^([a-zA-Z0-9_-]{11})$/
        ];

        for (const pattern of patterns) {
            const match = youtubeUrl.trim().match(pattern);
            if (match && match[1]) {
                videoId = match[1];
                break;
            }
        }

        const videoWrapper = document.getElementById('video-player-wrapper');
        const modal = document.getElementById('video-modal');

        // Always provide a button to open in new tab
        const openInNewTabBtn = `
            <div style="text-align: center; margin-top: 10px;">
                <a href="${youtubeUrl}" target="_blank" class="btn btn-secondary" style="font-size: 0.9rem;">
                    <i class="fab fa-youtube"></i> Watch on YouTube (New Tab)
                </a>
            </div>
        `;

        if (!videoId || videoId.length !== 11) {
            // Fallback: Just the button
            videoWrapper.innerHTML = `
                <div style="text-align:center; padding: 40px; color: white;">
                    <i class="fab fa-youtube" style="font-size: 4rem; color: #ff0000; margin-bottom: 20px;"></i>
                    <p style="margin-bottom: 20px; font-size: 1.2rem;">Video cannot be embedded.</p>
                    ${openInNewTabBtn}
                </div>`;
            modal.style.display = 'flex';
            return;
        }

        const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&showinfo=0&autoplay=1`;

        if (videoWrapper) {
            videoWrapper.innerHTML = `
                <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; background: #000;">
                    <iframe 
                        src="${embedUrl}" 
                        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border:0;" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                        allowfullscreen>
                    </iframe>
                </div>
                ${openInNewTabBtn}
            `;
            modal.style.display = 'flex';
        }
    }

    window.hideVideoModal = function () {
        document.getElementById('video-player-wrapper').innerHTML = '';
        document.getElementById('video-modal').style.display = 'none';
    }

    function showDocumentModal(url, fileName, type, courseId, contentId) {
        const modal = document.getElementById('document-modal');
        const viewer = document.getElementById('document-viewer-wrapper');
        const title = document.getElementById('document-title');
        const downloadLink = document.getElementById('document-download-link');

        const actualFileName = fileName || url.split('/').pop() || 'document';
        title.textContent = actualFileName;

        const extension = actualFileName.split('.').pop().toLowerCase();

        // Always construct the download URL using the specific endpoint
        const downloadUrl = (courseId && contentId)
            ? `${API_BASE_URL}/api/v1/student/course/${courseId}/download/${contentId}`
            : url;

        // URL for viewing (PDF only usually)
        const viewUrl = (courseId && contentId)
            ? `${API_BASE_URL}/api/v1/student/course/${courseId}/view/${contentId}`
            : url;

        // Setup the Download Button (Critical fix: ensure it's always visible and working)
        downloadLink.style.display = 'inline-block';
        downloadLink.innerHTML = `<i class="fas fa-download"></i> Download ${actualFileName}`;

        // Remove any old event listeners by cloning
        const newDownloadLink = downloadLink.cloneNode(true);
        downloadLink.parentNode.replaceChild(newDownloadLink, downloadLink);

        newDownloadLink.onclick = (e) => {
            e.preventDefault();
            downloadFileWithAuth(downloadUrl, actualFileName);
        };

        // Viewer Content Logic
        if (extension === 'pdf') {
            // PDF: Try to preview
            viewer.innerHTML = `<div style="padding:20px; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Loading PDF...</div>`;
            fetch(viewUrl, { headers: getAuthHeaders() })
                .then(response => {
                    if (!response.ok) throw new Error('Failed to load PDF');
                    return response.blob();
                })
                .then(blob => {
                    const pdfUrl = window.URL.createObjectURL(blob);
                    viewer.innerHTML = `<iframe src="${pdfUrl}" type="application/pdf" width="100%" height="600px" style="border:1px solid #ddd;"></iframe>`;
                    // Clean up logic
                    const oldHide = window.hideDocumentModal;
                    window.hideDocumentModal = function () {
                        window.URL.revokeObjectURL(pdfUrl);
                        if (oldHide) oldHide();
                        // Reset to avoid stacking
                        window.hideDocumentModal = function () {
                            document.getElementById('document-viewer-wrapper').innerHTML = '';
                            document.getElementById('document-modal').style.display = 'none';
                        };
                    };
                })
                .catch(error => {
                    console.error('PDF view error:', error);
                    viewer.innerHTML = `<div style="padding:40px; text-align:center;">
                        <i class="fas fa-file-pdf" style="font-size:4rem; color:#dc3545; margin-bottom:20px;"></i>
                        <p>Preview not available.</p>
                        <p>Please use the download button below.</p>
                    </div>`;
                });
        } else if (['doc', 'docx'].includes(extension)) {
            // Word: Render inline using Mammoth.js
            viewer.innerHTML = `<div style="padding:20px; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Converting Word Document...</div>`;

            fetch(viewUrl, { headers: getAuthHeaders() })
                .then(response => {
                    if (!response.ok) throw new Error('Failed to load document');
                    return response.arrayBuffer();
                })
                .then(arrayBuffer => {
                    // Check if mammoth is loaded
                    if (typeof mammoth === 'undefined') {
                        throw new Error('Mammoth.js library not loaded');
                    }

                    return mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
                })
                .then(result => {
                    const html = result.value; // The generated HTML
                    const messages = result.messages; // Any messages, such as warnings during conversion

                    // Display the HTML in a constrained container to mimic a page
                    viewer.innerHTML = `
                        <div style="background:white; padding:40px; border:1px solid;#eee; max-width:800px; margin:0 auto; box-shadow:0 2px 10px rgba(0,0,0,0.1); overflow-y:auto; max-height:600px; color:#333; line-height:1.6;">
                            ${html}
                        </div>
                        ${messages.length > 0 ? `<div style="text-align:center; color:orange; font-size:0.8rem; margin-top:10px;">Note: Some formatting may vary from original.</div>` : ''}
                    `;
                })
                .catch(error => {
                    console.error('Word rendering error:', error);
                    viewer.innerHTML = `<div style="padding:40px; text-align:center;">
                        <i class="fas fa-file-word" style="font-size:4rem; color:#2b579a; margin-bottom:20px;"></i><br>
                        <h3>Document Preview Failed</h3>
                        <p style="color:#666; margin-bottom:20px;">Could not render the document inline. ${error.message}</p>
                        <button class="btn btn-primary" onclick="document.querySelector('#document-download-link').click()">
                            <i class="fas fa-download"></i> Download File
                        </button>
                    </div>`;
                });
        } else {
            // Generic fallback
            viewer.innerHTML = `<div style="padding:40px; text-align:center;">
                <i class="fas fa-file-alt" style="font-size:4rem; color:#666; margin-bottom:20px;"></i><br>
                <h3>File Attachment</h3>
                <p style="color:#666;">Preview not available for this file type.</p>
                <p>Please download the file to view it.</p>
            </div>`;
        }

        modal.style.display = 'flex';
    }

    window.hideDocumentModal = function () {
        document.getElementById('document-viewer-wrapper').innerHTML = '';
        document.getElementById('document-modal').style.display = 'none';
    }

    // Handle authenticated file downloads
    function downloadFileWithAuth(url, preferredFilename) {
        fetch(url, { headers: getAuthHeaders() })
            .then(response => {
                if (!response.ok) throw new Error('Download failed');

                // Try to get filename from Content-Disposition header
                let filename = preferredFilename;
                const disposition = response.headers.get('Content-Disposition');
                if (disposition && disposition.indexOf('attachment') !== -1) {
                    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    const matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) {
                        filename = matches[1].replace(/['"]/g, '');
                    }
                }

                // Fallback if filename is still ID-like (no extension)
                if (!filename || filename.indexOf('.') === -1) {
                    filename = 'downloaded_file'; // Generic fallback
                }

                return response.blob().then(blob => ({ blob, filename }));
            })
            .then(({ blob, filename }) => {
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(downloadUrl);
            })
            .catch(error => {
                console.error('Download error:', error);
                showModal('error', 'Download Failed', 'Could not download the file.');
            });
    }

    // --- RENDERER FUNCTIONS ---

    async function renderDashboardSection() {
        const section = document.getElementById('dashboard-section');
        section.innerHTML = `<h2><i class="fas fa-tachometer-alt"></i> Dashboard</h2><div class="stats-container"><div class="stat-card"><i class="fas fa-book"></i><h3>Total Courses</h3><p id="total-courses">...</p></div><div class="stat-card"><i class="fas fa-book-open"></i><h3>My Courses</h3><p id="enrolled-count">...</p></div><div class="stat-card"><i class="fas fa-user-graduate"></i><h3>Completed</h3><p id="completed-count">...</p></div></div>`;
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/student/dashboard-stats`, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error('Could not fetch stats.');
            const stats = await response.json();
            document.getElementById('total-courses').textContent = stats.total_courses_available;
            document.getElementById('enrolled-count').textContent = stats.enrolled_courses_count;
            document.getElementById('completed-count').textContent = stats.completed_courses_count;
        } catch (error) {
            console.error('Dashboard Error:', error);
            section.innerHTML += `<p style="color:red">Failed to load stats.</p>`;
        }
    }

    async function renderProfileSection() {
        const section = document.getElementById('profile-section');
        section.innerHTML = `<h2><i class="fas fa-user-shield"></i> My Profile</h2><p>Loading profile...</p>`;
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/student/profile`, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error('Could not fetch profile.');
            studentProfileData = await response.json();
            section.innerHTML = `<h2><i class="fas fa-user-shield"></i> My Profile</h2><div id="profile-view"><div class="profile-item"><strong>Full Name:</strong> <span>${studentProfileData.full_name || ''}</span></div><div class="profile-item"><strong>Email:</strong> <span>${studentProfileData.email || ''}</span></div><div class="profile-item"><strong>Password:</strong> <span>${studentProfileData.password || ''}</span></div><div class="profile-item"><strong>Date of Birth:</strong> <span>${studentProfileData.date_of_birth || ''}</span></div><div class="profile-item"><strong>Gender:</strong> <span>${studentProfileData.gender || ''}</span></div><div class="profile-item"><strong>Security Question:</strong> <span>${studentProfileData.security_question || ''}</span></div><div class="profile-item"><strong>Security Answer:</strong> <span>${studentProfileData.security_answer || ''}</span></div><div class="profile-actions"><button class="btn" data-action="show-edit-profile"><i class="fas fa-edit"></i> Edit Profile</button><button class="btn btn-danger" data-action="delete-account"><i class="fas fa-trash-alt"></i> Delete Account</button></div></div><form id="profile-edit-form"><div class="form-group"><label>Full Name:</label><input type="text" id="edit-name" required></div><div class="form-group"><label>Email:</label><input type="email" id="edit-email" required></div><div class="form-group"><label>Password:</label><input type="text" id="edit-password" required></div><div class="form-group"><label>Date of Birth:</label><input type="date" id="edit-dob" required></div><div class="form-group"><label>Gender:</label><select id="edit-gender" required><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div><div class="form-group"><label>Security Question:</label><input type="text" id="edit-sec-question" required></div><div class="form-group"><label>Security Answer:</label><input type="text" id="edit-sec-answer" required></div><button type="submit" class="btn"><i class="fas fa-save"></i> Save Changes</button><button type="button" class="btn btn-secondary" data-action="cancel-edit"><i class="fas fa-times"></i> Cancel</button></form>`;
        } catch (error) {
            console.error(error);
            section.innerHTML = `<p style="color:red;">Could not load profile.</p>`;
        }
    }

    async function renderMessagesSection() {
        const section = document.getElementById('messages-section');
        section.innerHTML = `<h2><i class="fas fa-envelope"></i> Messages</h2>
            <div><h3>Send a Message to Admin</h3><form id="send-message-form"><div class="form-group"><label for="message-text">Your Message:</label><textarea id="message-text" rows="4" required placeholder="Type your query..."></textarea></div><button type="submit" class="btn">Send Message</button></form></div>
            <div style="margin-top: 40px; border-top: 2px solid var(--light-blue-bg); padding-top: 20px;"><h3>Received Messages</h3><div id="received-messages-container"><p>Loading messages...</p></div></div>`;
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/student/messages`, { headers: getAuthHeaders() });
            if (!response.ok) { throw new Error(`Failed to load messages. Server status: ${response.status}`); }
            const data = await response.json();
            // Handle both old format (array) and new format (object with messages property)
            const messages = Array.isArray(data) ? data : (data.messages || []);
            const container = document.getElementById('received-messages-container');
            if (messages && messages.length > 0) {
                container.innerHTML = '';
                messages.forEach(msg => {
                    const timestamp = msg.timestamp || msg.created_at || new Date().toISOString();
                    const date = new Date(timestamp).toLocaleString();
                    container.insertAdjacentHTML('beforeend', `
                        <div class="message-card">
                            <div class="message-card-header">
                                <strong>From: Admin</strong>
                                <span class="timestamp">${date}</span>
                            </div>
                            <p>${msg.message || msg.text || ''}</p>
                        </div>`);
                });
            } else {
                container.innerHTML = '<p style="padding: 20px; text-align: center; color: #666;">No messages from admin yet.</p>';
            }
        } catch (error) {
            console.error("Error in renderMessagesSection:", error);
            const container = document.getElementById('received-messages-container');
            if (container) {
                container.innerHTML = `<p style="color: red; padding: 20px;">Could not load messages: ${error.message}</p>`;
            }
        }
    }

    async function renderSearchSection() {
        const section = document.getElementById('search-section');
        section.innerHTML = `<h2><i class="fas fa-search"></i> Search & Enroll in Courses</h2><div class="form-group"><input type="search" id="course-search-input" class="form-group input" placeholder="Type to search for a course..."></div><div id="all-courses-container"><p>Loading available courses...</p></div>`;
        const searchInput = document.getElementById('course-search-input'), container = document.getElementById('all-courses-container');
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/courses/`, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error('Failed to fetch courses');
            allCoursesCache = await response.json();
            searchInput.oninput = () => {
                const searchTerm = searchInput.value.toLowerCase(),
                    filteredCourses = allCoursesCache.filter(c => c.title.toLowerCase().includes(searchTerm));
                displayCourses(filteredCourses, container);
            };
            displayCourses(allCoursesCache, container);
        } catch (error) { container.innerHTML = `<p style="color: red;">Could not load courses.</p>`; }
    }

    function displayCourses(courses, container) {
        container.innerHTML = courses.length > 0 ? '' : '<p>No courses match your search.</p>';
        courses.forEach(course => container.insertAdjacentHTML('beforeend', `<div class="course-card"><h3>${course.title}</h3><p>${course.description}</p><div class="course-card-actions"><button class="btn btn-success" data-action="enroll" data-course-id="${course._id}"><i class="fas fa-plus-circle"></i> Enroll Now</button>${course.youtubeLink ? `<a href="${course.youtubeLink}" target="_blank" class="btn btn-secondary"><i class="fab fa-youtube"></i> Watch Intro</a>` : ''}</div></div>`));
    }

    async function renderEnrolledSection() {
        const section = document.getElementById('enrolled-section');
        section.innerHTML = `<h2><i class="fas fa-book-open"></i> My Enrolled Courses</h2><div id="enrolled-courses-container"><p>Loading your courses...</p></div>`;
        try {
            // Fetch courses and progress in parallel
            const [coursesRes, progressRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/v1/student/enrolled-courses`, { headers: getAuthHeaders() }),
                fetch(`${API_BASE_URL}/api/v1/student/progress`, { headers: getAuthHeaders() })
            ]);

            if (!coursesRes.ok) throw new Error('Failed to fetch enrolled courses.');
            const courses = await coursesRes.json();

            let progressMap = {};
            if (progressRes.ok) {
                const progressData = await progressRes.json();
                progressData.forEach(p => progressMap[p.course_id] = p.percentage);
            }

            const container = document.getElementById('enrolled-courses-container');
            container.innerHTML = courses.length > 0 ? '' : '<p>You have not enrolled in any courses yet.</p>';

            courses.forEach(course => {
                const percentage = progressMap[course._id] || 0;
                let certButton = '';
                // Automatic Certificate Generation if 100% complete
                if (percentage === 100) {
                    certButton = `<button class="btn btn-success" data-action="download-cert" data-course-name="${course.title}" style="margin-left:10px; background-color:#28a745; color:white;"><i class="fas fa-certificate"></i> Download Certificate</button>`;
                }

                container.insertAdjacentHTML('beforeend', `
                    <div class="course-card" id="course-card-${course._id}">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <h3>${course.title}</h3>
                                <p>${course.description}</p>
                            </div>
                            <div class="progress-badge" style="background:${percentage === 100 ? '#28a745' : '#007bff'}; color:white; padding:5px 10px; border-radius:15px; font-size:0.8rem; white-space:nowrap; margin-left:10px;">
                                ${percentage}% Complete
                            </div>
                        </div>
                        <div class="course-card-actions" style="margin-top:15px;">
                            <button class="btn" data-action="view-course-content" data-course-id="${course._id}"><i class="fas fa-play-circle"></i> ${percentage === 0 ? 'Start Learning' : 'Continue Learning'}</button>
                            ${certButton}
                        </div>
                        <div class="course-content-area" style="display:none;"></div>
                    </div>`);
            });
        } catch (error) {
            console.error(error);
            document.getElementById('enrolled-courses-container').innerHTML = `<p style="color: red;">Could not load your courses.</p>`;
        }
    }

    async function renderCommentsSection() {
        const section = document.getElementById('comments-section');
        section.innerHTML = `<h2><i class="fas fa-comments"></i> Submit a Course Review</h2><form id="review-form"><div class="form-group"><label>Select a Course to Review:</label><select id="review-course-select" required><option>Loading...</option></select></div><div class="form-group rating-group"><label>Your Rating:</label><div class="rating"><input type="radio" id="star5" name="rating" value="5" /><label for="star5" title="5 stars"></label><input type="radio" id="star4" name="rating" value="4" /><label for="star4" title="4 stars"></label><input type="radio" id="star3" name="rating" value="3" /><label for="star3" title="3 stars"></label><input type="radio" id="star2" name="rating" value="2" /><label for="star2" title="2 stars"></label><input type="radio" id="star1" name="rating" value="1" /><label for="star1" title="1 star"></label></div></div><div class="form-group"><label>Your Comment:</label><textarea id="review-comment" rows="4" required placeholder="Share your experience..."></textarea></div><button type="submit" class="btn"><i class="fas fa-paper-plane"></i> Submit Review</button></form>`;
        const select = document.getElementById('review-course-select');
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/student/enrolled-courses`, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error('Failed to fetch enrolled courses.');
            const courses = await response.json();
            select.innerHTML = '<option value="">-- Please select a course --</option>';
            courses.forEach(course => select.add(new Option(course.title, course._id)));
        } catch (error) { select.innerHTML = '<option>Could not load courses</option>'; }
    }



    async function renderProgressSection() {
        const section = document.getElementById('progress-section');
        section.innerHTML = `<h2><i class="fas fa-chart-line"></i> Progress Tracking</h2><div id="progress-container"><p>Loading progress...</p></div>`;
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/student/progress`, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error("Could not fetch progress data.");
            const progressData = await response.json();
            const container = document.getElementById('progress-container');
            container.innerHTML = progressData.length > 0 ? '' : '<p>No progress to show. Start a course to begin!</p>';
            progressData.forEach(p => { container.innerHTML += `<h4>${p.course_title}</h4><div class="progress-bar-container"><div class="progress-bar" style="width: ${p.percentage}%;">${p.percentage}%</div></div>`; });
        } catch (error) {
            console.error("Error fetching progress:", error);
            document.getElementById('progress-container').innerHTML = `<p style="color:red;">Could not load progress data.</p>`;
        }
    }

    // --- EVENT LISTENERS & INITIALIZATION ---
    const mainContent = document.getElementById('main-content-area');
    mainContent.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        const courseId = target.dataset.courseId;

        if (action === 'show-edit-profile') {
            document.getElementById('profile-view').style.display = 'none';
            const form = document.getElementById('profile-edit-form');
            form.style.display = 'block';
            form.querySelector('#edit-name').value = studentProfileData.full_name;
            form.querySelector('#edit-email').value = studentProfileData.email;
            form.querySelector('#edit-password').value = studentProfileData.password;
            form.querySelector('#edit-dob').value = studentProfileData.date_of_birth;
            form.querySelector('#edit-gender').value = studentProfileData.gender;
            form.querySelector('#edit-sec-question').value = studentProfileData.security_question;
            form.querySelector('#edit-sec-answer').value = studentProfileData.security_answer;
        } else if (action === 'cancel-edit') {
            document.getElementById('profile-view').style.display = 'block';
            document.getElementById('profile-edit-form').style.display = 'none';
        } else if (action === 'delete-account') {
            showModal('confirm', 'Delete Account', 'This action is irreversible. Are you sure?', async () => {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/v1/student/profile`, { method: 'DELETE', headers: getAuthHeaders() });
                    if (!response.ok) throw new Error('Deletion failed.');
                    localStorage.clear();
                    showModal('success', 'Account Deleted', 'Your account has been deleted.');
                    setTimeout(() => window.location.href = '04_student_login.html', 2000);
                } catch (error) { showModal('error', 'Error', 'Could not delete your account.'); }
            });
        } else if (action === 'enroll') {
            showModal('confirm', 'Confirm Enrollment', 'Enroll in this course?', async () => {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/v1/student/enroll/${courseId}`, { method: 'POST', headers: getAuthHeaders() });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.detail || 'Enrollment failed.');
                    showModal('success', 'Success!', 'Enrolled successfully. View in "My Courses".');
                    await initializeDashboard();
                } catch (error) { showModal('error', 'Enrollment Failed', error.message); }
            });
        } else if (action === 'view-course-content') {
            const contentArea = document.querySelector(`#course-card-${courseId} .course-content-area`);
            if (contentArea.style.display === 'block') { contentArea.style.display = 'none'; return; }
            try {
                const response = await fetch(`${API_BASE_URL}/api/v1/student/course/${courseId}`, { headers: getAuthHeaders() });
                if (!response.ok) throw new Error("Could not load course content.");
                const courseData = await response.json();
                const contentList = courseData.course_content || [];
                let contentHtml = '<ul class="course-content-list">';
                contentList.forEach(item => {
                    const icon = item.type === 'file' ? 'fa-file-alt' : 'fa-video';
                    let url, name;
                    if (item.type === 'file') {
                        // Use the view URL if available (for PDF preview), otherwise use download URL
                        url = item.view_url ? `${API_BASE_URL}${item.view_url}` : (item.download_url ? `${API_BASE_URL}${item.download_url}` : `${API_BASE_URL}/uploads/${item.path.split('/').pop()}`);
                        name = item.name || 'File';
                    } else if (item.type === 'youtube') {
                        // Use the URL from the item (should be full YouTube URL)
                        url = item.url || '';
                        name = item.name || 'YouTube Video';
                    } else {
                        url = item.url || '';
                        name = item.name || 'Content';
                    }
                    contentHtml += `<li data-action="view-content-item" data-type="${item.type}" data-url="${url}" data-file-name="${name}" data-course-id="${courseId}" data-content-id="${item.content_id}" style="display:flex; justify-content:space-between; align-items:center;">
                        <span><i class="fas ${icon}"></i> ${name}</span>
                        ${item.type === 'file' ? `<button class="btn btn-sm btn-light" style="padding:2px 10px; font-size:0.8rem; z-index:10;" data-action="download-content-item" data-url="${url}" data-file-name="${name}"><i class="fas fa-download"></i></button>` : ''}
                    </li>`;
                });
                contentHtml += '</ul>';
                contentArea.innerHTML = contentList.length > 0 ? contentHtml : '<p>No content available for this course yet.</p>';
                contentArea.style.display = 'block';
            } catch (error) {
                contentArea.innerHTML = `<p style="color:red;">${error.message}</p>`;
                contentArea.style.display = 'block';
            }
        } else if (action === 'view-content-item') {
            const type = target.dataset.type,
                url = target.dataset.url,
                contentId = target.dataset.contentId,
                fileName = target.dataset.fileName || '';

            // Mark as complete (fire and forget)
            fetch(`${API_BASE_URL}/api/v1/student/course/${courseId}/mark-complete`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ content_id: contentId })
            }).catch(err => console.error('Failed to mark complete:', err));

            if (type === 'file') {
                // Open files in the dedicated viewer
                const viewerUrl = `viewer.html?url=${encodeURIComponent(url)}&type=${type}&courseId=${courseId}&contentId=${contentId}&name=${encodeURIComponent(fileName)}`;
                window.open(viewerUrl, '_blank');
            } else if (type === 'youtube') {
                // Open YouTube videos directly in a new tab as requested
                window.open(url, '_blank');
            }
        } else if (action === 'download-content-item') {
            const url = target.dataset.url;
            const fileName = target.dataset.fileName;
            // Prevent the view action from triggering if bubbled (though closest handles it, safety first)
            e.stopPropagation();
            downloadFileWithAuth(url, fileName);
        } else if (action === 'download-cert') {
            const { jsPDF } = window.jspdf;
            const courseName = target.dataset.courseName || "Course Completion";
            const studentName = studentProfileData.full_name || 'Valued Student';
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const w = doc.internal.pageSize.getWidth();
            const h = doc.internal.pageSize.getHeight();

            // Professional Color Palette
            const darkBlue = '#1a237e'; // Deep indigo
            const gold = '#cca43b'; // Metallic gold
            const textDark = '#333333';
            const textGrey = '#666666';

            // Background & Border
            doc.setFillColor('#ffffff'); doc.rect(0, 0, w, h, 'F'); // White bg

            // Double Border Frame
            doc.setDrawColor(darkBlue); doc.setLineWidth(1.5);
            doc.rect(10, 10, w - 20, h - 20); // Outer Blue
            doc.setDrawColor(gold); doc.setLineWidth(0.5);
            doc.rect(13, 13, w - 26, h - 26); // Inner Gold

            // Corner Accents (Decorative corners)
            doc.setFillColor(darkBlue);
            const cornerSize = 25;
            // Top Left
            doc.triangle(10, 10, 10 + cornerSize, 10, 10, 10 + cornerSize, 'F');
            // Bottom Right
            doc.triangle(w - 10, h - 10, w - 10 - cornerSize, h - 10, w - 10, h - 10 - cornerSize, 'F');

            // Header - LearnSphere Brand
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(textGrey);
            doc.text('LEARNSPHERE ACADEMY', w / 2, 40, { align: 'center' });

            // Title
            doc.setFont('times', 'bold');
            doc.setFontSize(42);
            doc.setTextColor(darkBlue);
            doc.text('CERTIFICATE OF COMPLETION', w / 2, 60, { align: 'center' });

            // Separator Line
            doc.setDrawColor(gold); doc.setLineWidth(1);
            doc.line(w / 2 - 40, 70, w / 2 + 40, 70);

            // "This certifies that"
            doc.setFont('times', 'italic');
            doc.setFontSize(14);
            doc.setTextColor(textDark);
            doc.text('This is to certify that', w / 2, 85, { align: 'center' });

            // Student Name (Highlight)
            doc.setFont('times', 'bolditalic');
            doc.setFontSize(36);
            doc.setTextColor(darkBlue);
            doc.text(studentProfileData.full_name || 'Valued Student', w / 2, 105, { align: 'center' });

            // Underline Name
            doc.setDrawColor(textGrey); doc.setLineWidth(0.2);
            doc.line(w / 2 - 60, 108, w / 2 + 60, 108);

            // "Has successfully completed"
            doc.setFont('times', 'normal');
            doc.setFontSize(14);
            doc.setTextColor(textDark);
            doc.text('has successfully completed the comprehensive course', w / 2, 125, { align: 'center' });

            // Course Name
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(24);
            doc.setTextColor(textDark);
            doc.text(courseName, w / 2, 140, { align: 'center' });

            // Footer Section
            const bottomY = h - 40;

            // Date
            const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            doc.setFont('times', 'normal');
            doc.setFontSize(12);
            doc.text('Date Issued', w / 4, bottomY);
            doc.setFont('times', 'bold');
            doc.text(today, w / 4, bottomY - 8);
            doc.setDrawColor(textDark); doc.line(w / 4 - 20, bottomY - 5, w / 4 + 20, bottomY - 5);

            // Signature
            doc.setFont('times', 'normal');
            doc.text('Director of Education', 3 * w / 4, bottomY);
            doc.setFont('times', 'bolditalic');
            doc.setFontSize(16);
            doc.setTextColor(darkBlue);
            doc.text('Mezan Ch', 3 * w / 4, bottomY - 8); // Dummy signature
            doc.setDrawColor(textDark); doc.setLineWidth(0.2);
            doc.line(3 * w / 4 - 20, bottomY - 5, 3 * w / 4 + 20, bottomY - 5);

            // Gold Seal Badge
            const sealX = w / 2;
            const sealY = h - 35;
            doc.setFillColor(gold);
            doc.circle(sealX, sealY, 12, 'F');
            doc.setDrawColor('#bbaa55'); doc.setLineWidth(1);
            doc.circle(sealX, sealY, 10, 'S');
            doc.setTextColor('#ffffff');
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('VERIFIED', sealX, sealY + 1, { align: 'center' });
            doc.text('★ ★ ★', sealX, sealY + 4, { align: 'center' });

            doc.save(`${studentName.replace(/ /g, '_')}_${courseName.replace(/ /g, '_')}_certificate.pdf`);
        }
    });

    mainContent.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (e.target.id === 'profile-edit-form') {
            const payload = {
                full_name: document.getElementById('edit-name').value,
                email: document.getElementById('edit-email').value,
                password: document.getElementById('edit-password').value,
                date_of_birth: document.getElementById('edit-dob').value,
                gender: document.getElementById('edit-gender').value,
                security_question: document.getElementById('edit-sec-question').value,
                security_answer: document.getElementById('edit-sec-answer').value
            };
            try {
                const response = await fetch(`${API_BASE_URL}/api/v1/student/profile`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(payload) });
                if (!response.ok) throw new Error((await response.json()).detail);
                showModal('success', 'Profile Updated', 'Your profile has been saved.');
                await renderProfileSection();
            } catch (error) { showModal('error', 'Update Failed', error.message); }
        } else if (e.target.id === 'send-message-form') {
            const message = document.getElementById('message-text').value;
            if (!message.trim()) { showModal('error', 'Error', 'Message cannot be empty.'); return; }
            try {
                const response = await fetch(`${API_BASE_URL}/api/v1/student/messages`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ message }) });
                if (!response.ok) throw new Error('Failed to send message.');
                showModal('success', 'Message Sent', 'Your message has been sent to the admin.');
                e.target.reset();
            } catch (error) { showModal('error', 'Error', 'Could not send the message.'); }
        } else if (e.target.id === 'review-form') {
            const courseId = document.getElementById('review-course-select').value,
                rating = document.querySelector('input[name="rating"]:checked')?.value,
                comment = document.getElementById('review-comment').value;
            if (!courseId || !rating) { showModal('error', 'Missing Info', 'Please select a course and provide a rating.'); return; }
            const payload = { course_id: courseId, student_name: studentProfileData.full_name, rating: parseInt(rating), comment: comment };
            try {
                const response = await fetch(`${API_BASE_URL}/api/v1/reviews/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
                if (!response.ok) throw new Error((await response.json()).detail || 'Failed to submit.');
                showModal('success', 'Review Submitted!', 'Thank you for your feedback.');
                e.target.reset();
            } catch (error) { showModal('error', 'Submission Failed', error.message); }
        }
    });

    const navLinks = document.querySelectorAll('.sidebar-nav a');
    const renderSection = (sectionId) => {
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(sectionId)?.classList.add('active');
        const renderer = {
            'dashboard-section': renderDashboardSection,
            'profile-section': renderProfileSection,
            'messages-section': renderMessagesSection,
            'search-section': renderSearchSection,
            'enrolled-section': renderEnrolledSection,
            'comments-section': renderCommentsSection,
            'progress-section': renderProgressSection
        };
        renderer[sectionId]?.();
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            if (link.id === 'nav-logout') {
                showModal('confirm', 'Confirm Logout', 'Are you sure?', () => { localStorage.clear(); window.location.href = '02_role_selection.html'; });
                return;
            }
            navLinks.forEach(nav => nav.classList.remove('active'));
            link.classList.add('active');
            renderSection(link.getAttribute('data-section'));
        });
    });

    async function initializeDashboard() {
        try {
            await renderProfileSection();
            renderSection('dashboard-section');
        } catch (error) {
            console.error("Initialization Failed:", error);
            showModal('error', 'Login Error', 'Your session may be invalid. Please log in again.');
        }
    }

    initializeDashboard();
});
