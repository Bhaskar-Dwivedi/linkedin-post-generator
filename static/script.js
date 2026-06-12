document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const themeToggle = document.getElementById('theme-toggle');
    const form = document.getElementById('post-form');
    const generateBtn = document.getElementById('generate-btn');
    
    // States
    const emptyState = document.getElementById('empty-state');
    const loadingState = document.getElementById('loading-state');
    const resultState = document.getElementById('result-state');
    
    // Content sections
    const hookSection = document.getElementById('hook-section');
    const mainContentSection = document.getElementById('main-content-section');
    const hashtagsSection = document.getElementById('hashtags-section');
    
    // Action buttons
    const copyBtn = document.getElementById('copy-btn');
    const downloadTxtBtn = document.getElementById('download-txt-btn');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    const regenerateBtn = document.getElementById('regenerate-btn');

    // Current data storage for regenerate
    let currentData = null;

    // Theme Toggle Logic
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const icon = themeToggle.querySelector('i');
        if (document.body.classList.contains('light-theme')) {
            icon.classList.remove('bx-sun');
            icon.classList.add('bx-moon');
        } else {
            icon.classList.remove('bx-moon');
            icon.classList.add('bx-sun');
        }
    });

    // Helper: Split text into Hook and Main Content
    function formatPost(text) {
        // A simple heuristic: first sentence or first paragraph is the hook
        const paragraphs = text.split('\n\n').filter(p => p.trim() !== '');
        let hook = '';
        let main = text;
        
        if (paragraphs.length > 1) {
            hook = paragraphs[0];
            main = paragraphs.slice(1).join('\n\n');
        }
        
        return { hook, main };
    }

    // Generate Post Logic
    async function generatePost(data) {
        // UI State: Loading
        emptyState.classList.add('hidden');
        resultState.classList.add('hidden');
        loadingState.classList.remove('hidden');
        
        generateBtn.disabled = true;
        generateBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Generating...";

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                let errorMsg = 'Network response was not ok';
                try {
                    const errResult = await response.json();
                    if (errResult.error) errorMsg = errResult.error;
                } catch (e) {}
                throw new Error(errorMsg);
            }

            const result = await response.json();
            
            // Get the specific tone the user requested
            const selectedTone = data.tone || 'professional';
            let postText = result[selectedTone] || 'Error generating post.';
            
            // Fix: The LLM sometimes creatively returns an object with a word_count field instead of just a string
            if (typeof postText === 'object' && postText !== null) {
                // If it has a 'text' or 'content' property, use that. Otherwise fallback to stringify
                postText = postText.text || postText.content || Object.values(postText)[0];
                if (typeof postText !== 'string') {
                    postText = JSON.stringify(postText);
                }
            }
            
            const { hook, main } = formatPost(postText);

            // Update UI
            hookSection.innerHTML = `<strong>${hook}</strong>`;
            mainContentSection.innerText = main;
            hashtagsSection.innerText = result.hashtags || '';

            // Update Word Count
            const postWordCount = postText.trim().split(/\s+/).length;
            document.getElementById('word-count-display').innerText = `Words: ${postWordCount}`;

            // UI State: Results
            loadingState.classList.add('hidden');
            resultState.classList.remove('hidden');

        } catch (error) {
            console.error('Error:', error);
            
            // Show the actual error so the user knows if the backend or API key is failing
            hookSection.innerHTML = `<strong>Error: Generation Failed</strong>`;
            mainContentSection.innerText = `Could not connect to the backend or the API failed.\n\nDetails: ${error.message}\n\nPlease ensure your Flask server (app.py) is running and your Groq API key is valid.`;
            hashtagsSection.innerText = ``;
            
            document.getElementById('word-count-display').innerText = `Words: 0`;
            
            loadingState.classList.add('hidden');
            resultState.classList.remove('hidden');
            
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = "<i class='bx bx-magic-wand'></i> Generate Post";
        }
    }

    // Form Submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        currentData = {
            title: document.getElementById('title').value,
            organization: document.getElementById('organization').value,
            duration: document.getElementById('duration').value,
            skills: document.getElementById('skills').value,
            bullets: document.getElementById('bullets').value,
            tone: document.getElementById('tone').value,
            wordCount: document.getElementById('wordCount').value
        };

        generatePost(currentData);
    });

    // Regenerate Button
    regenerateBtn.addEventListener('click', () => {
        // Re-gather the data in case the user changed the word count or other fields
        const updatedData = {
            title: document.getElementById('title').value,
            organization: document.getElementById('organization').value,
            duration: document.getElementById('duration').value,
            skills: document.getElementById('skills').value,
            bullets: document.getElementById('bullets').value,
            tone: document.getElementById('tone').value,
            wordCount: document.getElementById('wordCount').value
        };
        generatePost(updatedData);
    });

    // Get full text for actions
    function getFullText() {
        const hookText = hookSection.innerText;
        const mainText = mainContentSection.innerText;
        const hashText = hashtagsSection.innerText;
        return `${hookText}\n\n${mainText}\n\n${hashText}`;
    }

    // Copy to Clipboard
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(getFullText()).then(() => {
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = "<i class='bx bx-check'></i> Copied!";
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
            }, 2000);
        });
    });

    // Download TXT
    downloadTxtBtn.addEventListener('click', () => {
        const text = getFullText();
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'LinkedIn_Post.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Download PDF (using html2pdf.js loaded in index.html)
    downloadPdfBtn.addEventListener('click', () => {
        const element = document.getElementById('post-content-area');
        
        // Temporarily adjust styles for PDF rendering if needed
        const opt = {
            margin:       1,
            filename:     'LinkedIn_Post.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, backgroundColor: document.body.classList.contains('light-theme') ? '#ffffff' : '#1E293B' },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        const originalBtnHTML = downloadPdfBtn.innerHTML;
        downloadPdfBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i>...";
        
        html2pdf().set(opt).from(element).save().then(() => {
            downloadPdfBtn.innerHTML = originalBtnHTML;
        });
    });
});
