// Native fetch assumed

const BASE_URL = 'https://api.craftcorps.net';

async function probe() {
    const endpoints = [
        '/cosmetics',
        '/cosmetics/list',
        '/cosmetics/all',
        '/cosmetics/catalog',
        '/cosmetics/capes', // might return all if no UUID?
        '/store/cosmetics'
    ];

    for (const ep of endpoints) {
        try {
            console.log(`Checking ${ep}...`);
            const res = await fetch(`${BASE_URL}${ep}`);
            console.log(`${ep}: ${res.status}`);
            if (res.ok) {
                const data = await res.json();
                console.log(`SUCCESS! Data length: ${Array.isArray(data) ? data.length : 'Object'}`);
                if (Array.isArray(data) && data.length > 0) console.log('Sample:', data[0]);
            }
        } catch (e) {
            console.log(`${ep}: Error - ${e.message}`);
        }
    }
}

probe();
