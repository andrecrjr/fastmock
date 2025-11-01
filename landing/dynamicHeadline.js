// Array of possible headlines
const headlines = [
    "Tired of waiting for backend development?",
    "Stuck debugging unstable API endpoints?",
    "Frontend development blocked by backend issues?"
];

// Function to get a random headline
function getRandomHeadline() {
    const randomIndex = Math.floor(Math.random() * headlines.length);
    return headlines[randomIndex];
}

// Function to insert the headline when the DOM is ready
function insertDynamicHeadline() {
    const headlineElement = document.getElementById('dynamic-headline');
    if (headlineElement) {
        headlineElement.textContent = getRandomHeadline();
    }
}

// Wait for the DOM to be fully loaded before inserting the headline
document.addEventListener('DOMContentLoaded', function() {
    insertDynamicHeadline();
});