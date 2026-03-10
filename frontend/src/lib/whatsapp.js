/**
 * Utility for direct WhatsApp redirection without saving contacts.
 */

export const openWhatsApp = (phoneNumber, message) => {
    // 1. Clean the phone number (keep only digits)
    const cleanNumber = phoneNumber.replace(/\D/g, '');

    // 2. Encode the message
    const encodedMessage = encodeURIComponent(message);

    // 3. Create the wa.me link
    // This works on both mobile (opens app) and desktop (opens web.whatsapp)
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;

    // 4. Open in a new tab
    window.open(whatsappUrl, '_blank');
};

/**
 * Generates the sharing message for the patient.
 */
export const generateShareMessage = (patientName, targetLanguage, sharedLink) => {
    return `Hello ${patientName}! 🏥

Here is your medical report summary in ${targetLanguage}, analyzed by MedInsight AI.

You can view the summary and listen to the audio playback here:
${sharedLink}

Disclaimer: This is an AI summary and not a professional medical diagnosis.`;
};
