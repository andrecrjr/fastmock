document.addEventListener('DOMContentLoaded', function() {
    const testApiBtn = document.getElementById('testApiBtn');
    const apiUrlInput = document.getElementById('apiUrl');
    const responseContainer = document.getElementById('responseContainer');
    const responseStatus = document.getElementById('responseStatus');
    const responseTime = document.getElementById('responseTime');
    
    testApiBtn.addEventListener('click', async function() {
        const apiUrl = apiUrlInput.value.trim();
        if (!apiUrl) {
            alert('Please enter a valid API URL');
            return;
        }
        
        // Clear previous response
        responseContainer.innerHTML = '<div class="text-gray-400">Loading...</div>';
        responseStatus.textContent = 'Status: -';
        responseStatus.className = 'px-3 py-1 rounded-full text-white font-medium bg-gray-500';
        responseTime.textContent = 'Response time: -';
        
        try {
            // Record start time for response time calculation
            const startTime = Date.now();
            
            // Make the API request
            const response = await fetch(apiUrl);
            
            // Calculate response time
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Update response time display
            responseTime.textContent = `Response time: ${duration}ms`;
            
            // Update status display
            responseStatus.textContent = `Status: ${response.status}`;
            if (response.status >= 200 && response.status < 300) {
                responseStatus.className = 'px-3 py-1 rounded-full text-white font-medium bg-green-500';
            } else if (response.status >= 400 && response.status < 500) {
                responseStatus.className = 'px-3 py-1 rounded-full text-white font-medium bg-yellow-500';
            } else {
                responseStatus.className = 'px-3 py-1 rounded-full text-white font-medium bg-red-500';
            }
            
            // Get response text
            let responseText = await response.text();
            
            try {
                // Try to parse as JSON to format it nicely
                const responseData = JSON.parse(responseText);
                responseText = JSON.stringify(responseData, null, 2);
            } catch (e) {
                // If not JSON, just display as text
            }
            
            // Display the response
            responseContainer.innerHTML = '<pre class="text-green-400">' + escapeHtml(responseText) + '</pre>';
        } catch (error) {
            responseStatus.textContent = 'Status: Network Error';
            responseStatus.className = 'px-3 py-1 rounded-full text-white font-medium bg-red-500';
            responseContainer.innerHTML = '<div class="text-red-400">Error: ' + escapeHtml(error.message) + '</div>';
        }
    });
    
    // Utility function to escape HTML to prevent XSS
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});