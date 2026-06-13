import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

export async function analyzeRFQ(fileBuffer: Buffer, mimeType: string) {
  const prompt = `
    Analyze this RFQ (Request for Quotation) document.
    Please:
    1. Extract the key technical requirements and objectives.
    2. Identify exactly one critical ambiguity or missing piece of information that requires human clarification.
    3. Suggest the ideal skillsets (e.g., specific frameworks, years of experience, certifications) needed for a team to succeed.

    Format your entire response as a raw JSON object with these keys:
    {
      "requirements": ["string"],
      "ambiguity": "string",
      "suggestedSkills": ["string"]
    }
  `;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: fileBuffer.toString("base64"),
        mimeType: mimeType
      }
    }
  ]);
  
  const response = await result.response;
  const text = response.text().replace(/```json|```/g, "").trim();
  return JSON.parse(text);
}

export async function matchEmployees(requirements: string[], employees: any[]) {
  const prompt = `
    Based on these technical requirements:
    ${requirements.join(", ")}

    Rank these employees based on their fit for the project:
    ${JSON.stringify(employees, null, 2)}

    For each employee, provide:
    1. A match score (0-100).
    2. A brief reason for the score.
    3. The key skills they contribute.

    Format the response as a JSON array of objects:
    [
      {
        "id": "string",
        "name": "string",
        "role": "string",
        "match": number,
        "reason": "string",
        "skills": ["string"]
      }
    ]
    Sort by match score descending.
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text().replace(/```json|```/g, "").trim();
  return JSON.parse(text);
}
