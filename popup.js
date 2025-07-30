// Main popup script
class TCExtension {
    constructor() {
        this.termsLinks = [];
        this.summaries = {};
        this.init();
    }

    // Initialize the extension
    init() {
        this.bindEvents();
        this.scanCurrentPage();
    }

    // Bind all event listeners
    bindEvents() {
        const refreshBtn = document.getElementById('refreshBtn');
        refreshBtn.addEventListener('click', () => this.scanCurrentPage());
    }

    // Scan current tab for T&C links
    async scanCurrentPage() {
        this.showLoading(true);

        try {
            // Get current active tab
            const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true
            });

            // Execute script to find links
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    return Array.from(document.querySelectorAll('a'))
                        .map(a => ({
                            text: a.textContent.trim(),
                            href: a.href,
                            type: /privacy/i.test(a.textContent) || /privacy/i.test(a.href) ? 'Privacy Policy' :
                                /terms/i.test(a.textContent) || /terms/i.test(a.href) ? 'Terms of Service' : null
                        }))
                        .filter(link => link.type);
                }
            });

            this.termsLinks = results[0].result || [];
            this.displayLinks();

        } catch (error) {
            console.error('Error scanning page:', error);
            this.showError('Failed to scan page');
        } finally {
            this.showLoading(false);
        }
    }

    // Display found links in the popup
    displayLinks() {
        const container = document.getElementById('linksContainer');
        const noLinksDiv = document.getElementById('noLinks');

        if (this.termsLinks.length === 0) {
            container.innerHTML = '';
            noLinksDiv.classList.remove('hidden');
            return;
        }

        noLinksDiv.classList.add('hidden');
        container.innerHTML = this.termsLinks
            .map((link, index) => this.createLinkCard(link, index))
            .join('');

        // Bind summarize buttons
        this.bindSummarizeButtons();
    }

    // Create HTML for each link card
    createLinkCard(link, index) {
        const priority = this.getPriority(link.type);

        return `
            <div class="terms-card priority-${priority}" data-index="${index}">
                <div class="card-header">
                    <div class="link-info">
                        <span class="link-type">${link.type}</span>
                        <h4>${link.text}</h4>
                        <a href="${link.href}" target="_blank" class="external-link">
                            ${this.truncateUrl(link.href)}
                        </a>
                    </div>
                    <button class="btn-summarize" data-index="${index}">
                         Summarize
                    </button>
                </div>
                <div class="summary-section hidden" id="summary-${index}">
                    <!-- Summary content will be inserted here -->
                </div>
            </div>
        `;
    }

    // Bind click events to summarize buttons
    bindSummarizeButtons() {
        const summarizeButtons = document.querySelectorAll('.btn-summarize');

        summarizeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.summarizeLink(index);
            });
        });
    }

    // Summarize a specific link
    async summarizeLink(index) {
        const link = this.termsLinks[index];
        const button = document.querySelector(`[data-index="${index}"]`);
        const summarySection = document.getElementById(`summary-${index}`);

        // Check if already summarized
        if (this.summaries[link.href]) {
            this.displaySummary(summarySection, this.summaries[link.href]);
            summarySection.classList.remove('hidden');
            return;
        }

        // Show loading state
        button.textContent = 'Analyzing...';
        button.disabled = true;

        try {
            // Fetch the T&C content
            const content = await this.fetchContent(link.href);

            // Generate summary using AI
            const summary = await this.generateSummary(content);

            // Cache the summary
            this.summaries[link.href] = summary;

            // Display the summary
            this.displaySummary(summarySection, summary);
            summarySection.classList.remove('hidden');

        } catch (error) {
            console.error('Error summarizing:', error);
            summarySection.innerHTML = `
                <div class="error">
                     Failed to analyze this document
                </div>
            `;
            summarySection.classList.remove('hidden');
        }
        finally {
            button.textContent = 'Summarize';
        }
    }

    // Fetch content from T&C URL
    async fetchContent(url) {
        try {
            const response = await fetch(url);
            const text = await response.text();

            // Extract text content from HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');

            // Remove scripts and styles
            const scripts = doc.querySelectorAll('script, style');
            scripts.forEach(el => el.remove());


            return doc.body.textContent || doc.body.innerText || '';

        } catch (error) {
            throw new Error('Failed to fetch content');
        }
    }

    // Generate AI summary
    async generateSummary(content) {
        // Import AI processor
        const { AIProcessor } = await import('./Utils/aiProcessor.js');
        const processor = new AIProcessor();

        return await processor.summarize(content);
    }

    // Display summary in the UI
    displaySummary(container, summary) {
        const keyPoints = Array.isArray(summary.keyPoints) ? summary.keyPoints : [];
        const risks = Array.isArray(summary.risks) ? summary.risks : [];
        const recommendations = Array.isArray(summary.recommendations) ? summary.recommendations : [];
        container.innerHTML = `
            <div class="summary-content">
                <h5>Key Points</h5>
                <ul class="key-points">
                    ${keyPoints.length > 0 ? keyPoints.map(point => `
                        <li class="key-point">${point}</li>
                    `).join('')
                : '<li>No key points found.</li>'}
                </ul>

                <h5>Important Risks</h5>
                <div class="risks">
                    ${risks.length > 0
                ? risks.map(risk => `
                        <div class="risk-item severity-${risk.severity}">
                            <span class="severity-badge">${risk.severity}</span>
                            <span class="risk-text">${risk.description}</span>
                        </div>
                    `).join('')
                : '<div>No risks found.</div>'}
                </div>

                <h5>Recommendations</h5>
                <div class="recommendations">
                    ${recommendations.length > 0
                ? recommendations.map(rec => `
                        <span class="recommendation-badge">${rec}</span>
                    `).join('')
                : '<span>No recommendations found.</span>'}
                </div>
            </div>
        `;
        container.classList.remove('hidden');
    }

    // Helper functions
    getPriority(type) {
        const highPriority = ['Privacy Policy', 'Terms of Service'];
        const mediumPriority = ['Cookie Policy'];

        if (highPriority.includes(type)) return 'high';
        if (mediumPriority.includes(type)) return 'medium';
        return 'low';
    }

    truncateUrl(url) {
        if (url.length <= 50) return url;
        return url.substring(0, 47) + '...';
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        const container = document.getElementById('linksContainer');

        if (show) {
            loading.classList.remove('hidden');
            container.classList.add('hidden');
        } else {
            loading.classList.add('hidden');
            container.classList.remove('hidden');
        }
    }

    showError(message) {
        const container = document.getElementById('linksContainer');
        container.innerHTML = `<div class="error">${message}</div>`;
    }
}

// Initialize when popup loads
document.addEventListener('DOMContentLoaded', () => {
    new TCExtension();
});
