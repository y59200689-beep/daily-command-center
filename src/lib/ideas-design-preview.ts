import type { Idea } from './ideas-dashboard';
export const previewIdeas:Idea[] = [
 ['Radiology lead magnet campaign','Create a free guide for radiology practices with imaging marketing tips to generate leads and grow our email list.','Marketing','high','exploring'],
 ['Para Divine referral program','Build a client referral system with rewards and thoughtful follow-ups.','Business','high','captured'],
 ['Weekend content system','Batch and schedule a month of content in a focused weekend.','Content','medium','drafting'],
 ['Client onboarding automation','Automate welcome sequences and resource sharing for new clients.','Operations','high','exploring'],
 ['Running challenge content series','A 30-day running challenge with daily tips and community encouragement.','Personal','medium','drafting'],
 ['Founder state weekly reset','Weekly routine for mindset, strategy and reflection.','Personal','medium','ready'],
].map(([title,description,category,potential,status],index)=>({id:`design-preview-${index}`,title,description,category,potential,status,project_id:null,created_at:'2026-09-12T12:00:00Z',updated_at:`2026-09-${26-index}T12:00:00Z`}));
