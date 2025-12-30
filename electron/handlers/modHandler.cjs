const { setupModrinthHandlers } = require('./modrinthHandler.cjs');
const { setupLocalModHandlers } = require('./localModHandler.cjs');
const { setupResourcePackHandlers } = require('./resourcePackHandler.cjs');

function setupModHandlers(getMainWindow) {
    setupModrinthHandlers();
    setupLocalModHandlers();
    setupResourcePackHandlers();
}

module.exports = { setupModHandlers };
