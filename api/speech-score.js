// Vercel Serverless Function to proxy SpeechAce API calls
// This avoids CORS issues by calling SpeechAce from server-side

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { audio_base64, text, dialect = 'en-us', user_id = 'demo_user' } = req.body;

        // Validate required fields
        if (!audio_base64 || !text) {
            return res.status(400).json({ 
                error: 'Missing required fields: audio_base64 and text' 
            });
        }

        console.log('Backend: Processing speech scoring request');
        console.log('Text to score:', text);
        console.log('Audio size:', audio_base64.length, 'characters');

        // SpeechAce API configuration
        const SPEECHACE_API_URL = 'https://api2.speechace.com/api/scoring/text/v9/json';
        const SPEECHACE_API_KEY = 'd1%2FF3cUOCGysWtj6%2Fcp94p1Ft3FGa7EiId3Z4v5gHL76jfSMTQ%2BHHlW2sSYf1VRHkHmjKAyjVRLaX5E6VUOm0oFrtoaTFYxsWFd87nDAns%2BBEIKTSDWWV8owIqsLtfv4';

        // Prepare form data for SpeechAce API
        const formData = new URLSearchParams({
            'key': SPEECHACE_API_KEY,
            'audio_base64': audio_base64,
            'text': text,
            'question_info': 'u1/q1',
            'dialect': dialect,
            'user_id': user_id
        });

        console.log('Backend: Calling SpeechAce API...');

        // Call SpeechAce API from server (no CORS issues)
        const response = await fetch(SPEECHACE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
            body: formData
        });

        console.log('Backend: SpeechAce response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Backend: SpeechAce API error:', errorText);
            throw new Error(`SpeechAce API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('Backend: SpeechAce API success');

        // Return the result to frontend
        return res.status(200).json({
            success: true,
            data: result,
            message: 'SpeechAce API call successful'
        });

    } catch (error) {
        console.error('Backend: Error processing request:', error);

        // Return error to frontend
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to process speech scoring request'
        });
    }
}
