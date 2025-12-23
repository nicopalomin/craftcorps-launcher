const { BrowserWindow } = require('electron');
const https = require('https');

const CLIENT_ID = "00000000-402b-9153-0000-000000000000"; // Default Minecraft Launcher ID
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
                        const msTokenData = await post('https://login.live.com/oauth20_token.srf', {
                            client_id: CLIENT_ID,
                            code: code,
                            grant_type: 'authorization_code',
                            redirect_uri: REDIRECT_URI
                        });

                        // 2. Xbox Live Auth
                        const xblData = await post('https://user.auth.xboxlive.com/user/authenticate', {
                            Properties: {
                                AuthMethod: 'RPS',
                                SiteName: 'user.auth.xboxlive.com',
                                RpsTicket: `d=${msTokenData.access_token}`
                            },
                            RelyingParty: 'http://auth.xboxlive.com',
                            TokenType: 'JWT'
                        }, { 'Content-Type': 'application/json' });

                        // 3. XSTS Auth
                        const xstsData = await post('https://xsts.auth.xboxlive.com/xsts/authorize', {
                            Properties: {
                                SandboxId: 'RETAIL',
                                UserTokens: [xblData.Token]
                            },
                            RelyingParty: 'rp://api.minecraftservices.com/',
                            TokenType: 'JWT'
                        }, { 'Content-Type': 'application/json' });

                        // 4. Minecraft Auth
                        const mcLoginData = await post('https://api.minecraftservices.com/authentication/login_with_xbox', {
                            identityToken: `XBL3.0 x=${xblData.DisplayClaims.xui[0].uhs};${xstsData.Token}`
                        }, { 'Content-Type': 'application/json' });

                        // 5. Get Profile
                        const profile = await get('https://api.minecraftservices.com/minecraft/profile', {
                            'Authorization': `Bearer ${mcLoginData.access_token}`
                        });

                        resolve({
                            uuid: profile.id,
                            name: profile.name,
                            accessToken: mcLoginData.access_token,
                            type: 'Microsoft'
                        });

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
