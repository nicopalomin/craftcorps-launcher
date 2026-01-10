const { setupModrinthHandlers } = require('./modrinthHandler.cjs');
const { setupLocalModHandlers } = require('./localModHandler.cjs');
const { setupResourcePackHandlers } = require('./resourcePackHandler.cjs');

function setupModHandlers(getMainWindow) {
    console.log('[MAIN] setupModHandlers called');
    const modrinthHandlers = setupModrinthHandlers();
    const localModHandlers = setupLocalModHandlers();
    const resourcePackHandlers = setupResourcePackHandlers();

    return {
        ...modrinthHandlers,
        ...localModHandlers,
        ...resourcePackHandlers
    };
}

module.exports = { setupModHandlers };
