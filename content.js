// This script runs on every webpage to find T&C links

(function () {
    'use strict';

    // Keywords to identify T&C links
    const TERMS_KEYWORDS = [
        'terms', 'conditions', 'privacy', 'policy', 'agreement',
        'license', 'legal', 'disclaimer', 'cookies'
    ];

    // Main function to find all T&C links on the page
    function findTermsLinks() {
        const links = [];
        const allLinks = document.querySelectorAll('a[href]');

        allLinks.forEach(link => {
            const text = link.textContent.toLowerCase().trim();
            const href = link.href.toLowerCase();

            // Check if link contains T&C keywords
            const isTermsLink = TERMS_KEYWORDS.some(keyword =>
                text.includes(keyword) || href.includes(keyword)
            );

            if (isTermsLink) {
                links.push({
                    href: link.href,
                    text: link.textContent.trim(),
                    type: classifyLinkType(text, href)
                });
            }
        });

        // Remove duplicates
        return removeDuplicates(links);
    }

    // Classify what type of legal document it is
    function classifyLinkType(text, href) {
        if (text.includes('privacy') || href.includes('privacy')) {
            return 'Privacy Policy';
        }
        if (text.includes('terms') || href.includes('terms')) {
            return 'Terms of Service';
        }
        if (text.includes('cookie') || href.includes('cookie')) {
            return 'Cookie Policy';
        }
        if (text.includes('eula') || href.includes('license')) {
            return 'License Agreement';
        }
        return 'Legal Document';
    }

    // Remove duplicate links
    function removeDuplicates(links) {
        const seen = new Set();
        return links.filter(link => {
            const key = link.href;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'findTermsLinks') {
            const links = Array.from(document.querySelectorAll('a')).map(a => a.href);
            sendResponse({ links: links });
        }
    });

    // Make function available globally for direct injection
    window.findTermsLinks = findTermsLinks;
})();