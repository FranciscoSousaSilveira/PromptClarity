"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeVscodeRewritePresentation = describeVscodeRewritePresentation;
exports.buildVscodeTooMuchFeedbackEntry = buildVscodeTooMuchFeedbackEntry;
const product_1 = require("../config/product");
const popupState_1 = require("./popupState");
function normalizeReason(reason) {
    if (typeof reason !== 'string')
        return null;
    const normalized = reason.trim();
    return normalized.length > 0 ? normalized : null;
}
function describeVscodeRewritePresentation(input) {
    const intervention = input.intervention || product_1.DEFAULT_REWRITE_INTERVENTION;
    const reason = normalizeReason(input.validationReason);
    const copyText = input.status === 'error' ? input.original : input.rewritten;
    if (input.status === 'no_change') {
        return {
            status: 'no_change',
            title: 'Prompt checked',
            subtitle: 'No changes needed',
            message: 'The local rewrite kept your prompt unchanged.',
            originalLabel: 'Original prompt',
            rewrittenLabel: 'Same text',
            copyLabel: 'Copy Original',
            insertLabel: 'Insert Original',
            canInsert: true,
            canCopy: true,
            copyText,
            intervention,
            validationReasonText: 'No changes were needed',
            source: 'checkmark'
        };
    }
    if (input.status === 'changed') {
        return {
            status: 'changed',
            title: 'Corrected prompt',
            subtitle: 'Conservative local correction',
            message: 'The corrected prompt keeps the original intent and stays local.',
            originalLabel: 'Original prompt',
            rewrittenLabel: 'Corrected prompt',
            copyLabel: 'Copy',
            insertLabel: 'Insert',
            canInsert: true,
            canCopy: true,
            copyText,
            intervention,
            validationReasonText: reason || 'Local correction applied',
            source: input.source
        };
    }
    if (input.status === 'fallback') {
        return {
            status: 'fallback',
            title: 'Conservative local correction',
            subtitle: 'Safe local fallback used',
            message: input.error
                ? 'The model response was rejected, so a safe local correction was used instead.'
                : 'A safe local correction was used to keep your prompt local.',
            originalLabel: 'Original prompt',
            rewrittenLabel: 'Fallback rewrite',
            copyLabel: 'Copy',
            insertLabel: 'Insert',
            canInsert: true,
            canCopy: true,
            copyText,
            intervention,
            validationReasonText: reason || 'Conservative local fallback used',
            source: 'local_fallback'
        };
    }
    return {
        status: 'error',
        title: 'Local rewrite unavailable',
        subtitle: 'Your text stayed local',
        message: input.error || 'The local service is unavailable right now.',
        originalLabel: 'Original prompt',
        rewrittenLabel: 'Unavailable',
        copyLabel: 'Copy Original',
        insertLabel: 'Insert',
        canInsert: false,
        canCopy: true,
        copyText,
        intervention,
        validationReasonText: reason || 'Local rewrite unavailable',
        source: 'error'
    };
}
function buildVscodeTooMuchFeedbackEntry(input) {
    return (0, popupState_1.buildTooMuchFeedbackEntry)({ ...input, surface: 'vscode' });
}
//# sourceMappingURL=vscodePresentation.js.map