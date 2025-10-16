// import { Request, Response } from 'express';
// import { autocompletePlace, getPlaceDetails } from '../services/googleMapsService';

// export const autocomplete = async (req: Request, res: Response): Promise<Response> => {
//   try {
//     const input = String(req.query.input || '').trim();
//     const sessiontoken = String(req.query.sessiontoken || '');
//     if (!input || input.length < 2) {
//       return res.status(400).json({ success: false, message: 'input is required and must be at least 2 characters' });
//     }
//     const components = String(req.query.components || '');
//     const data = await autocompletePlace(input, sessiontoken, components || undefined);
//     return res.json({ success: true, data: data.predictions });
//   } catch (error: any) {
//     console.error('Autocomplete error:', error);
//     return res.status(500).json({ success: false, message: error.message || 'Autocomplete failed' });
//   }
// };

// export const placeDetails = async (req: Request, res: Response): Promise<Response> => {
//   try {
//     const place_id = String(req.query.place_id || '');
//     const sessiontoken = String(req.query.sessiontoken || '');
//     if (!place_id) return res.status(400).json({ success: false, message: 'place_id is required' });

//     const details = await getPlaceDetails(place_id, sessiontoken || undefined);
//     return res.json({ success: true, data: details });
//   } catch (error: any) {
//     console.error('Place details error:', error);
//     return res.status(500).json({ success: false, message: error.message || 'Place details failed' });
//   }
// };
