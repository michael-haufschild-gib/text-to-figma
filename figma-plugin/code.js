/**
 * Figma Plugin Main Thread
 * Handles Figma API operations with strict type safety
 */
import { isCreateFrameCommand, isCreateTextCommand, validateCreateFramePayload, validateCreateTextPayload, } from './types';
// Show the plugin UI
figma.showUI(__html__, { width: 400, height: 300 });
/**
 * Creates a frame node with specified properties
 */
async function createFrame(payload) {
    try {
        const frame = figma.createFrame();
        // Set position and size
        frame.x = payload.x;
        frame.y = payload.y;
        frame.resize(payload.width, payload.height);
        // Set name if provided
        if (payload.name) {
            frame.name = payload.name;
        }
        // Set fill color if provided
        if (payload.fillColor) {
            frame.fills = [
                {
                    type: 'SOLID',
                    color: {
                        r: payload.fillColor.r,
                        g: payload.fillColor.g,
                        b: payload.fillColor.b,
                    },
                },
            ];
        }
        // Scroll to the created frame
        figma.viewport.scrollAndZoomIntoView([frame]);
        return {
            status: 'success',
            message: `Frame created: ${frame.name}`,
            nodeId: frame.id,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            status: 'error',
            message: 'Failed to create frame',
            error: errorMessage,
        };
    }
}
/**
 * Creates a text node with specified properties
 */
async function createText(payload) {
    try {
        // Load font before creating text
        const fontName = payload.fontName || { family: 'Inter', style: 'Regular' };
        try {
            await figma.loadFontAsync(fontName);
        }
        catch (fontError) {
            // Fallback to default font if specified font is not available
            console.warn(`Font ${fontName.family} ${fontName.style} not available, using default`);
            await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
        }
        const textNode = figma.createText();
        // Set position
        textNode.x = payload.x;
        textNode.y = payload.y;
        // Set font properties
        try {
            textNode.fontName = fontName;
        }
        catch {
            // Use default if setting font fails
            textNode.fontName = { family: 'Inter', style: 'Regular' };
        }
        if (payload.fontSize) {
            textNode.fontSize = payload.fontSize;
        }
        // Set text content
        textNode.characters = payload.text;
        // Scroll to the created text node
        figma.viewport.scrollAndZoomIntoView([textNode]);
        return {
            status: 'success',
            message: `Text created: "${textNode.characters}"`,
            nodeId: textNode.id,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            status: 'error',
            message: 'Failed to create text',
            error: errorMessage,
        };
    }
}
/**
 * Handles incoming commands from UI thread
 */
async function handleCommand(command) {
    // Validate payload based on command type
    if (isCreateFrameCommand(command)) {
        if (!validateCreateFramePayload(command.payload)) {
            return {
                status: 'error',
                message: 'Invalid create_frame payload',
                error: 'Payload validation failed',
            };
        }
        return createFrame(command.payload);
    }
    if (isCreateTextCommand(command)) {
        if (!validateCreateTextPayload(command.payload)) {
            return {
                status: 'error',
                message: 'Invalid create_text payload',
                error: 'Payload validation failed',
            };
        }
        return createText(command.payload);
    }
    // This should never happen with proper types, but included for completeness
    return {
        status: 'error',
        message: 'Unknown command type',
        error: 'Command type not recognized',
    };
}
/**
 * Message handler for UI thread communication
 */
figma.ui.onmessage = async (msg) => {
    try {
        // Type guard to validate incoming message structure
        if (!msg || typeof msg !== 'object') {
            throw new Error('Invalid message format');
        }
        const message = msg;
        if (!message.type || typeof message.type !== 'string') {
            throw new Error('Message missing type field');
        }
        if (!message.payload || typeof message.payload !== 'object') {
            throw new Error('Message missing payload field');
        }
        // Validate command type and construct typed command
        let command;
        if (message.type === 'create_frame') {
            command = {
                type: 'create_frame',
                payload: message.payload,
            };
        }
        else if (message.type === 'create_text') {
            command = {
                type: 'create_text',
                payload: message.payload,
            };
        }
        else {
            throw new Error(`Unknown command type: ${message.type}`);
        }
        // Handle command and send response
        const response = await handleCommand(command);
        figma.ui.postMessage({
            type: 'response',
            data: response,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        figma.ui.postMessage({
            type: 'response',
            data: {
                status: 'error',
                message: 'Failed to process command',
                error: errorMessage,
            },
        });
    }
};
/**
 * Cleanup on plugin close
 */
figma.on('close', () => {
    console.log('Plugin closed');
});
