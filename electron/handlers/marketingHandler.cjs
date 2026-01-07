const https = require('https');

// CONFIGURATION - TO BE FILLED BY USER
// Get these from your Kit.com (formerly ConvertKit) dashboard.
// Account -> Settings -> Developers -> API Key (Public API Key is safe for form subscriptions)
// Forms -> Click Form -> URL has the ID (e.g. kit.com/forms/12345)
const KIT_API_KEY = 'Pib-3glSe0QxoDmIyTy0Lg';
const KIT_FORM_ID = '8947621'; // Use the numeric ID (e.g. from the editor URL), NOT the public UID
const BASE_URL = 'https://api.convertkit.com/v3';

/**
 * Subscribes an email to the configured Kit.com form.
 * @param {string} email - The email address to subscribe.
 * @param {object} tags - Optional tags to add (not supported on public form endpoint directly usually, but we can try or skip).
 * @returns {Promise<object>} - The response from Kit.
 */
async function subscribeToNewsletter(event, email) {
    if (!email || !email.includes('@')) {
        throw new Error('Invalid email address');
    }

    if (KIT_API_KEY === 'YOUR_PUBLIC_API_KEY_HERE' || KIT_FORM_ID === 'YOUR_FORM_ID_HERE') {
        console.warn('Kit API not configured. Please set KIT_API_KEY and KIT_FORM_ID in marketingHandler.cjs');
        // Simulate success for UI testing if credentials aren't set
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true, message: 'Simulated subscription (API keys not set)' };
    }

    const url = `${BASE_URL}/forms/${KIT_FORM_ID}/subscribe`;

    // Using Node.js https module which is more robust for simple API calls
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            api_key: KIT_API_KEY,
            email: email
        });

        const request = https.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body).toString() // Ensure string
            }
        }, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                console.log(`[Kit] Status: ${response.statusCode}`); // LOG
                console.log(`[Kit] Body: ${data}`); // LOG

                if (response.statusCode >= 200 && response.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed);
                    } catch (e) {
                        resolve({ success: true }); // Assume success if status is OK but JSON fails
                    }
                } else {
                    reject(new Error(`Kit API Error: ${response.statusCode} - ${data}`));
                }
            });
        });

        request.on('error', (error) => {
            reject(error);
        });

        request.write(body);
        request.end();
    });
}

module.exports = { subscribeToNewsletter };
