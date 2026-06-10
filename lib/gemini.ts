import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

export const gemini = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

export async function extractProfileFromCV(cvText: string) {
  const prompt = `
You are a career analyst. Extract structured information from this CV/resume text.
Return ONLY valid JSON with this exact shape:
{
  "name": string,
  "email": string | null,
  "skills": string[],
  "jobTitles": string[],
  "yearsOfExperience": number,
  "summary": string
}

CV Text:
${cvText}
`
  const result = await gemini.generateContent(prompt)
  const text = result.response.text()
  const json = text.match(/\{[\s\S]*\}/)
  if (!json) throw new Error('Could not parse profile from CV')
  return JSON.parse(json[0])
}

export async function analyzeSkillGaps(skills: string[], jobDescriptions: string[]) {
  const prompt = `
You are a career coach. Compare a developer's current skills against common requirements in job listings.

Developer skills: ${skills.join(', ')}

Job descriptions sample:
${jobDescriptions.slice(0, 5).join('\n---\n')}

Return ONLY valid JSON:
{
  "missingSkills": [{ "skill": string, "frequency": number, "priority": "high"|"medium"|"low" }],
  "roadmap": [{ "skill": string, "resource": string, "estimatedWeeks": number }]
}
`
  const result = await gemini.generateContent(prompt)
  const text = result.response.text()
  const json = text.match(/\{[\s\S]*\}/)
  if (!json) throw new Error('Could not parse skill gap analysis')
  return JSON.parse(json[0])
}

export async function draftFollowUpEmail(company: string, role: string, appliedDate: string) {
  const prompt = `
Draft a short, professional follow-up email for a job application.
Company: ${company}
Role: ${role}
Applied on: ${appliedDate}

Keep it under 100 words. Warm, professional, not desperate.
Return ONLY the email body text (no subject line).
`
  const result = await gemini.generateContent(prompt)
  return result.response.text()
}

export async function agentChat(message: string, context: string) {
  const prompt = `
You are a Remote Career Copilot — an AI assistant helping developers in emerging markets find and land remote jobs.

Context about the user:
${context}

User message: ${message}

Respond helpfully and concisely. If the user wants to log an application, extract: company, role, date.
If they ask for jobs or skill gaps, tell them you'll search now.
`
  const result = await gemini.generateContent(prompt)
  return result.response.text()
}
