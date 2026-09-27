// Development-only visual fixtures. The route never passes these in production.
export const leadsDesignPreview = [
 {id:'preview-para',name:'Para Divine',company:null,source:'website',status:'new',potential_value:5000,currency:'USD',notes:'Interested in our project management solution for their creative team. Had an initial call and is evaluating options with two other providers.'},
 {id:'preview-orion',name:'Orion Creative',company:'Design & Branding',source:'referral',status:'contacted',potential_value:12000,currency:'USD'},
 {id:'preview-summit',name:'Summit Health',company:'Healthcare Services',source:'networking',status:'qualified',potential_value:25000,currency:'USD'},
 {id:'preview-nova',name:'Nova Properties',company:'Real Estate',source:'email',status:'contacted',potential_value:8000,currency:'USD'},
 {id:'preview-bluepeak',name:'Bluepeak Media',company:'Marketing Agency',source:'website',status:'contacted',potential_value:15000,currency:'USD'},
 {id:'preview-lumen',name:'Lumen Tech',company:'Software & SaaS',source:'existing_client',status:'qualified',potential_value:30000,currency:'USD'},
 {id:'preview-crestview',name:'Crestview Capital',company:'Investment Firm',source:'networking',status:'new',potential_value:20000,currency:'USD'},
].map((row,index)=>({...row,id:`00000000-0000-4000-8000-00000000000${index}`,created_at:'2026-09-22T10:00:00Z',updated_at:'2026-09-27T10:00:00Z',next_follow_up_at:`2026-${index<3?'09':'10'}-${String(index<3?28+index:2+index).padStart(2,'0')}T10:00:00Z`}));
