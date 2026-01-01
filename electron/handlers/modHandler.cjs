const { setupModrinthHandlers } = require('./modrinthHandler.cjs');
const { setupLocalModHandlers } = require('./localModHandler.cjs');
const { setupResourcePackHandlers } = require('./resourcePackHandler.cjs');

function setupModHandlers(getMainWindow) {
    console.log('[MAIN] setupModHandlers called');
    setupModrinthHandlers();
    setupLocalModHandlers();
    setupResourcePackHandlers();
}

module.exports = { setupModHandlers };
