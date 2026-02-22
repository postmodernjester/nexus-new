export interface WorkEntry {
  id?: string
  title: string
  company: string
  location: string
  start_date: string
  end_date: string
  is_current: boolean
  description: string
  engagement_type: string
}

export interface EducationEntry {
  id?: string
  institution: string
  degree: string
  field_of_study: string
  start_date: string
  end_date: string
  is_current: boolean
  description: string
}

export interface ChronicleResumeEntry {
  id: string
  type: string
  title: string
  start_date: string
  end_date: string | null
  note: string | null
  canvas_col: string
  color: string | null
  show_on_resume: boolean
  description?: string | null
  image_url?: string | null
}

export interface Skill {
  id?: string
  name: string
  category: string
  proficiency: number
}

export interface KeyLink {
  type: string
  url: string
  visible: boolean
}

export const LINK_TYPES = [
  { type: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/yourname' },
  { type: 'wikipedia', label: 'Wikipedia', placeholder: 'https://en.wikipedia.org/wiki/Your_Name' },
  { type: 'twitter', label: 'X / Twitter', placeholder: 'https://x.com/yourhandle' },
  { type: 'github', label: 'GitHub', placeholder: 'https://github.com/yourhandle' },
  { type: 'website', label: 'Personal Website', placeholder: 'https://yoursite.com' },
]

export const CAT_LABELS: Record<string, string> = {
  work: 'Work', project: 'Project', personal: 'Personal',
  residence: 'Residence', tech: 'Tech', people: 'People',
}

export const EMPTY_WORK: WorkEntry = {
  title: '', company: '', location: '', start_date: '', end_date: '',
  is_current: false, description: '', engagement_type: 'full-time'
}

export const EMPTY_EDU: EducationEntry = {
  institution: '', degree: '', field_of_study: '', start_date: '', end_date: '',
  is_current: false, description: ''
}

export const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export const CURRENT_YEAR = new Date().getFullYear()
export const YEARS = Array.from({ length: 80 }, (_, i) => CURRENT_YEAR - i)
