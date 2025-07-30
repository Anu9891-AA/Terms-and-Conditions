// AI Processing utility for summarizing T&C content
export class AIProcessor {
    constructor() {
        this.apiKey = ''; // Set your OpenAI API key here
    }

    // Main summarization function
    async summarize(content) {
        // Limit content length for API efficiency
        const limitedContent = this.limitContent(content, 4000);

        //     try {
        //         // Try AI summarization first
        //         if (this.apiKey) {
        //             return await this.aiSummarize(limitedContent);
        //         } else {
        //             // Fallback to rule-based processing
        //             console.log('No API key provided, using rule-based summarization.');
        //             return this.ruleBasedSummarize(limitedContent);
        //         }
        //     } catch (error) {
        //         console.error('AI processing failed, using fallback:', error);
        //         return this.ruleBasedSummarize(limitedContent);
        //     }
        // }

        try {
            // Try AI summarization first
            if (this.apiKey) {
                const result = await this.aiSummarize(limitedContent);
                // Add a check for the result before accessing index 0
                if (typeof result === 'string' && result.length > 0) {
                    return result; // Assuming aiSummarize returns an array or similar
                } else {
                    console.error('AI summarization returned unexpected result, using fallback.');
                    return this.ruleBasedSummarize(limitedContent);
                }
            } else {
                // Fallback to rule-based processing
                console.log('No API key provided, using rule-based summarization.');
                return this.ruleBasedSummarize(limitedContent);
            }
        } catch (error) {
            console.error('AI processing failed, using fallback:', error);
            return this.ruleBasedSummarize(limitedContent);
        }
    }

    // OpenAI API summarization
    async aiSummarize(content) {
        const prompt = this.createPrompt(content);
        for (let attempt = 1; attempt <= 3; attempt++) {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    max_tokens: 1000,
                    temperature: 0.3
                })
            });

            if (response.status === 429) {
                const delay = 1000 * attempt; // Exponential backoff
                console.warn(`429 Too Many Requests. Retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
                continue;
            }

            const data = await response.json();
            let apiResponse;
            try {
                if (
                    data &&
                    Array.isArray(data.choices) &&
                    data.choices.length > 0 &&
                    data.choices[0].message &&
                    data.choices[0].message.content
                ) {
                    apiResponse = JSON.parse(data.choices[0].message.content);
                } else {
                    throw new Error("OpenAI API returned unexpected format");
                }
            } catch (err) {
                console.warn('⚠️ AI response not valid JSON:', data?.choices?.[0]?.message?.content);
                apiResponse = {
                    keyPoints: ["Failed to parse summary."],
                    risks: [],
                    recommendations: []
                };
            }
        }

        console.log('AI response:', apiResponse);
        return apiResponse;
    }

    // Rule-based summarization (fallback)
    ruleBasedSummarize(content) {
        const sentences = this.extractSentences(content);

        return {
            keyPoints: [this.extractKeyPoints(sentences)],
            risks: [this.identifyRisks(sentences)],
            recommendations: [this.generateRecommendations()]
        };
    }

    // Extract important sentences
    extractSentences(content) {
        return content
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 20);
    }

    // Extract key points using keyword matching
    extractKeyPoints(sentences) {
        const keywordPatterns = [
            /data collect/i,
            /personal information/i,
            /third.{0,10}part/i,
            /termination/i,
            /liability/i
        ];

        const keyPoints = [];

        keywordPatterns.forEach(pattern => {
            const match = sentences.find(s => pattern.test(s));
            if (match) {
                keyPoints.push(this.cleanSentence(match));
            }
        });

        return keyPoints.slice(0, 5); // Limit to 5 points
    }

    // Identify potential risks
    identifyRisks(sentences) {
        const riskPatterns = [
            { pattern: /not liable/i, severity: 'high', description: 'Company limits liability' },
            { pattern: /share.{0,20}information/i, severity: 'medium', description: 'Data sharing with third parties' },
            { pattern: /terminate.{0,20}account/i, severity: 'medium', description: 'Account termination rights' }
        ];

        const risks = [];

        riskPatterns.forEach(({ pattern, severity, description }) => {
            if (sentences.some(s => pattern.test(s))) {
                risks.push({ severity, description });
            }
        });

        return risks;
    }

    // Generate recommendations
    generateRecommendations() {
        return [
            'Review data sharing policies',
            'Understand termination conditions',
            'Check liability limitations',
            'Note dispute resolution process'
        ];
    }

    // Create AI prompt
    createPrompt(content) {
        return `
Analyze this Terms & Conditions document and extract:

1. 5 most important key points
2. Major risks/restrictions for users
3. 4 actionable recommendations

Content: "${content}"

Respond in JSON format:
{
  "keyPoints": ["point1", "point2", "point3", "point4", "point5"],
  "risks": [{"severity": "high|medium|low", "description": "risk description"}],
  "recommendations": ["rec1", "rec2", "rec3", "rec4"]
}
        `;
    }

    // Helper functions
    limitContent(content, maxLength) {
        if (content.length <= maxLength) return content;
        return content.substring(0, maxLength) + '...';
    }

    cleanSentence(sentence) {
        return sentence
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 150) + (sentence.length > 150 ? '...' : '');
    }
}