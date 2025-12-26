const { BrowserWindow } = require('electron');
const https = require('https');

const CLIENT_ID = "2f559a44-6b34-4e39-9f6d-2e02fbe2caf8"; // Custom Application ID
// NOTE: If you get "Invalid app registration" (AUTH_INVALID_APP_CONFIG), it means Mojang has not approved your App ID.
// For DEVELOPMENT ONLY, you can test with a known ID (e.g. Prism Launcher's ID) to verify your code works:
// const CLIENT_ID = "d173c8d1-561b-4b2d-9b1b-4d7a8d7a1240"; // Prism Launcher (Open Source) - USE ONLY FOR DEV TEST
const REDIRECT_URI = "https://login.live.com/oauth20_desktop.srf";

function post(url, data, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + (urlObj.search || ''),
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                ...headers
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (res.statusCode >= 400) reject(parsed);
                    else resolve(parsed);
                } catch (e) {
                    reject(body);
                }
            });
        });

        req.on('error', reject);

        // Handle both form data string and JSON handling
        if (headers['Content-Type'] === 'application/json') {
            req.write(JSON.stringify(data));
        } else {
            // Form url encoded
            const params = new URLSearchParams(data).toString();
            req.write(params);
        }

        req.end();
    });
}

function get(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + (urlObj.search || ''),
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                ...headers
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (res.statusCode >= 400) reject(parsed);
                    else resolve(parsed);
                } catch (e) {
                    reject(body);
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function authenticateMicrosoft(mainWindow) {
    return new Promise((resolve, reject) => {
        const authWindow = new BrowserWindow({
            width: 500,
            height: 600,
            show: true,
            parent: mainWindow,
            modal: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        const authUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=XboxLive.signin%20offline_access`;

        authWindow.loadURL(authUrl);

        authWindow.webContents.on('will-redirect', async (event, url) => {
            if (url.startsWith(REDIRECT_URI)) {
                // Prevent actually loading the redirect page
                event.preventDefault();
                authWindow.close();

                const urlObj = new URL(url);
                const code = urlObj.searchParams.get('code');
                const error = urlObj.searchParams.get('error');

                if (error) {
                    reject(new Error(`Microsoft Auth Error: ${error}`));
                    return;
                }

                if (code) {
                    try {
                        // 1. Get MS Token
                        let msTokenData;
                        try {
                            msTokenData = await post('https://login.live.com/oauth20_token.srf', {
                                client_id: CLIENT_ID,
                                code: code,
                                grant_type: 'authorization_code',
                                redirect_uri: REDIRECT_URI
                            });
                        } catch (e) {
                            throw new Error('AUTH_MS_TOKEN_FAILED');
                        }

                        // 2. Xbox Live Auth
                        let xblData;
                        try {
                            xblData = await post('https://user.auth.xboxlive.com/user/authenticate', {
                                Properties: {
                                    AuthMethod: 'RPS',
                                    SiteName: 'user.auth.xboxlive.com',
                                    RpsTicket: `d=${msTokenData.access_token}`
                                },
                                RelyingParty: 'http://auth.xboxlive.com',
                                TokenType: 'JWT'
                            }, { 'Content-Type': 'application/json' });
                        } catch (e) {
                            throw new Error('AUTH_XBOX_LIVE_FAILED');
                        }

                        // 3. XSTS Auth (Critical for Xbox Account checks)
                        let xstsData;
                        try {
                            xstsData = await post('https://xsts.auth.xboxlive.com/xsts/authorize', {
                                Properties: {
                                    SandboxId: 'RETAIL',
                                    UserTokens: [xblData.Token]
                                },
                                RelyingParty: 'rp://api.minecraftservices.com/',
                                TokenType: 'JWT'
                            }, { 'Content-Type': 'application/json' });
                        } catch (e) {
                            // Check for specific XSTS error codes
                            if (e && e.XErr) {
                                switch (e.XErr) {
                                    case 2148916233: // No Xbox Account
                                        throw new Error('AUTH_NO_XBOX_ACCOUNT');
                                    case 2148916238: // Child Account / Family Settings
                                        throw new Error('AUTH_CHILD_ACCOUNT');
                                    default:
                                        throw new Error(`AUTH_XSTS_FAILED_${e.XErr}`);
                                }
                            }
                            throw new Error('AUTH_XSTS_FAILED');
                        }

                        // 4. Minecraft Auth
                        let mcLoginData;
                        try {
                            // Validate Token Structure
                            if (!xblData?.DisplayClaims?.xui?.[0]?.uhs) {
                                console.error('Invalid XBL Data Structure:', JSON.stringify(xblData, null, 2));
                                throw new Error('INVALID_XBL_DATA');
                            }
                            if (!xstsData?.Token) {
                                console.error('Invalid XSTS Data Structure:', JSON.stringify(xstsData, null, 2));
                                throw new Error('INVALID_XSTS_DATA');
                            }

                            mcLoginData = await post('https://api.minecraftservices.com/authentication/login_with_xbox', {
                                identityToken: `XBL3.0 x=${xblData.DisplayClaims.xui[0].uhs};${xstsData.Token}`
                            }, { 'Content-Type': 'application/json' });
                        } catch (e) {
                            console.error('Minecraft Login Request Failed:', e);

                            // Check for specific App Registration error
                            if (e && e.errorMessage && e.errorMessage.includes('Invalid app registration')) {
                                throw new Error('AUTH_INVALID_APP_CONFIG');
                            }

                            // If it's a structure error, throw that
                            if (e.message === 'INVALID_XBL_DATA' || e.message === 'INVALID_XSTS_DATA') {
                                throw e;
                            }
                            // Otherwise it's an API error
                            throw new Error(`AUTH_MC_LOGIN_FAILED: ${JSON.stringify(e)}`);
                        }

                        // 5. Get Profile
                        try {
                            const profile = await get('https://api.minecraftservices.com/minecraft/profile', {
                                'Authorization': `Bearer ${mcLoginData.access_token}`
                            });

                            if (profile.error) {
                                throw new Error('AUTH_NO_MINECRAFT');
                            }

                            resolve({
                                uuid: profile.id,
                                name: profile.name,
                                accessToken: mcLoginData.access_token,
                                type: 'Microsoft'
                            });
                        } catch (e) {
                            throw new Error('AUTH_PROFILE_FAILED');
                        }

                    } catch (err) {
                        reject(err);
                    }
                }
            }
        });

        authWindow.on('closed', () => {
            // If promise not settled (no code found), reject
            // We can't easy check if resolved, but usually user closing window implies cancellation
            // If we already resolved/rejected, this might be redundant but safe
            // reject(new Error('User closed login window'));
        });
    });
}

module.exports = { authenticateMicrosoft };
