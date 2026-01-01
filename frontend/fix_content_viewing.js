// YOUTUBE AND DOWNLOAD FIX
// Add this script tag to 05_student_dashboard.html right before </body>
// <script src="fix_content_viewing.js"></script>

// Override the showVideoModal function to fix YouTube Error 153
window.showVideoModal = function (youtubeUrl) {
    let videoId = null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/
    ];

    for (const pattern of patterns) {
        const match = youtubeUrl.match(pattern);
        if (match && match[1]) {
            videoId = match[1];
            break;
        }
    }

    if (!videoId) {
        showModal('error', 'Invalid URL', 'Could not extract video ID from the YouTube link.');
        return;
    }

    // Use youtube-nocookie.com to avoid Error 153
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;

    document.getElementById('video-player-wrapper').innerHTML =
        `<iframe width="100%" height="100%" src="${embedUrl}" frameborder="0" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;

    document.getElementById('video-modal').style.display = 'flex';
};

// Override showDocumentModal to fix file download naming
window.showDocumentModal = function (url, fileName, type) {
    const modal = document.getElementById('document-modal');
    const viewer = document.getElementById('document-viewer-wrapper');
    const title = document.getElementById('document-title');
    const downloadLink = document.getElementById('document-download-link');

    // Extract filename from URL if not provided
    const actualFileName = fileName || url.split('/').pop() || 'document';

    title.textContent = actualFileName;
    downloadLink.href = url;
    downloadLink.setAttribute('download', actualFileName);

    const extension = actualFileName.split('.').pop().toLowerCase();

    if (extension === 'pdf') {
        viewer.innerHTML = `<embed src="${url}" type="application/pdf" width="100%" height="500px" />`;
    } else if (['doc', 'docx'].includes(extension)) {
        viewer.innerHTML = `<p style="padding:20px; text-align:center;">Word documents cannot be previewed in browser.<br><br>Please use the download button below to view this file.</p>`;
    } else {
        viewer.innerHTML = `<p>Preview not available for this file type. Please download to view.</p>`;
    }

    modal.style.display = 'flex';
};

console.log('✅ Content viewing fixes loaded successfully!');
