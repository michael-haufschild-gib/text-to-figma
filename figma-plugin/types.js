/**
 * Shared type definitions for Figma plugin message contracts
 * Zero 'any' types - strict type safety enforced
 */
// Type guards for runtime validation
export function isCreateFrameCommand(cmd) {
    return cmd.type === 'create_frame';
}
export function isCreateTextCommand(cmd) {
    return cmd.type === 'create_text';
}
export function isSuccessResponse(response) {
    return response.status === 'success';
}
export function isErrorResponse(response) {
    return response.status === 'error';
}
// Validation helpers
export function validateCreateFramePayload(payload) {
    if (!payload || typeof payload !== 'object')
        return false;
    const p = payload;
    return (typeof p.x === 'number' &&
        typeof p.y === 'number' &&
        typeof p.width === 'number' &&
        typeof p.height === 'number' &&
        (p.name === undefined || typeof p.name === 'string') &&
        (p.fillColor === undefined || (typeof p.fillColor === 'object' &&
            p.fillColor !== null &&
            typeof p.fillColor.r === 'number' &&
            typeof p.fillColor.g === 'number' &&
            typeof p.fillColor.b === 'number')));
}
export function validateCreateTextPayload(payload) {
    if (!payload || typeof payload !== 'object')
        return false;
    const p = payload;
    return (typeof p.x === 'number' &&
        typeof p.y === 'number' &&
        typeof p.text === 'string' &&
        (p.fontSize === undefined || typeof p.fontSize === 'number') &&
        (p.fontName === undefined || (typeof p.fontName === 'object' &&
            p.fontName !== null &&
            typeof p.fontName.family === 'string' &&
            typeof p.fontName.style === 'string')));
}
