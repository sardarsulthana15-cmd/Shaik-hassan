import { GoogleGenAI, Type, Schema } from "@google/genai";
import { WorkflowStep, ExecutionContext, StepStatus } from '../types';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Schema for the planning phase
const planSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    workflowName: { type: Type.STRING, description: "A creative name for this automation workflow" },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Short title of the step" },
          description: { type: Type.STRING, description: "Detailed instruction for what this step should do with the data" },
          actionType: { 
            type: Type.STRING, 
            enum: ['analysis', 'generation', 'extraction', 'formatting', 'simulation', 'search'],
            description: "The type of action performed"
          }
        },
        required: ['title', 'description', 'actionType']
      }
    }
  },
  required: ['workflowName', 'steps']
};

export const generateWorkflowPlan = async (userGoal: string, initialData: string) => {
  try {
    const prompt = `
      You are an expert Automation Architect.
      Goal: "${userGoal}"
      Initial Data Sample: "${initialData.substring(0, 500)}..."

      Create a logical, step-by-step workflow to achieve this goal.
      
      Supported Action Types:
      - 'search': ESSENTIAL for finding live jobs.
      - 'analysis': Analyzing keywords or data.
      - 'generation': Writing content (emails, cover letters).
      - 'extraction': Pulling specific fields.
      
      Rules:
      1. Step 1 MUST be 'search' to find DIRECT APPLICATION LINKS (ATS, Career Pages, Forms) in INDIA.
      2. Step 2 MUST be 'analysis' to extract ATS Keywords from those findings.
      3. Step 3 MUST be 'generation' to write a tailored Cover Letter for these roles.
      4. Ensure instructions are specific and high-quality.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: planSchema,
        systemInstruction: "You are a helpful assistant that structures requests into linear workflows."
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Error planning workflow:", error);
    throw error;
  }
};

export const executeWorkflowStep = async (
  step: WorkflowStep, 
  context: ExecutionContext
): Promise<{ output: string; sources?: { title: string; uri: string }[] }> => {
  try {
    // Construct the context for the model
    let previousContextString = `Original Input (Snippet):\n${context.originalInput.substring(0, 1000)}\n\n`;
    
    // Add context from previous steps
    const contextKeys = Object.keys(context.stepOutputs);
    if (contextKeys.length > 0) {
      previousContextString += "--- Data from Previous Steps ---\n";
      contextKeys.forEach((key, index) => {
        // We limit the output size to prevent context overflow or distraction
        const output = context.stepOutputs[key] || '';
        previousContextString += `Step ${index + 1} Output:\n${output.substring(0, 2000)}\n\n`;
      });
    }

    let searchInstruction = "";
    if (step.actionType === 'search') {
        searchInstruction = `
        CRITICAL INSTRUCTION - "DIRECT LINK HUNTER" (INDIA) - ACTIVE JOBS ONLY:
        The user wants **DIRECT APPLICATION LINKS** for **CURRENTLY OPEN** jobs.
        
        1. STATUS CHECK (CRITICAL):
           - **EXCLUDE** any result that says: "Closed", "Expired", "No longer accepting", "Filled", "404".
           - **ONLY** return links that appear valid and active.
           - TIME WINDOW: **LAST 3 DAYS ONLY**.
        
        2. STRICT SEARCH QUERIES (Use 'site:' operator to find direct portals):
           - **Google Forms**: site:docs.google.com/forms "resume" "apply"
           - **Greenhouse**: site:boards.greenhouse.io
           - **Lever**: site:jobs.lever.co
           - **Ashby**: site:jobs.ashbyhq.com
           - **BambooHR**: site:bamboohr.com/jobs
           - **Workday**: site:myworkdayjobs.com
           - **Company Career Pages**: "apply now" (site:.in/careers OR site:.com/careers OR site:.io/careers)
        
        3. LOCATION & ROLE:
           - Focus on **INDIA** (Bangalore, Gurgaon, Remote).
           - Role: Use context from user input.
        
        4. BANNED DOMAINS (DO NOT RETURN THESE):
           - naukri.com
           - indeed.com
           - linkedin.com
           - glassdoor.com
           - foundit.in
           - instahyre.com
           - ambitionbox.com
        
        5. OUTPUT FORMAT:
           - List exactly 20 items if found.
           - Format: "1. [Role] at [Company] - [Source Platform] - [Direct Link]"
           - Example: "1. Frontend Dev at Swiggy - Greenhouse - https://boards.greenhouse.io/swiggy/jobs/12345"
        `;
    } else if (step.actionType === 'analysis') {
        searchInstruction = `
        Based on the list of DIRECT LINKS found, EXTRACT the top 15 "Hard Skills" and "Keywords".
        Output them as a comma-separated list for use in a Resume.
        `;
    } else if (step.actionType === 'generation') {
        searchInstruction = `
        Write a "Universal Cover Letter" that works for the jobs found above.
        - Context: Applying to Startups/MNCs in India via Direct Links.
        - Mention the specific job title (e.g. "${context.originalInput}") and the top keywords found.
        - Keep it professional, persuasive, and optimized for ATS.
        `;
    }

    const prompt = `
      You are an Automation Executor Engine.
      
      CURRENT TASK:
      Title: ${step.title}
      Instruction: ${step.description}
      Action Type: ${step.actionType}

      ${searchInstruction}

      CONTEXT DATA:
      ${previousContextString}

      EXECUTION:
      Perform the "CURRENT TASK" using the "CONTEXT DATA".
      If this is a search task, use the googleSearch tool to find real links.
      If this is a generation task, output the generated content directly.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        // Enable Google Search for all steps to allow grounding
        tools: [{ googleSearch: {} }]
      }
    });

    // Extract sources if available
    let sources: { title: string; uri: string }[] = [];
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      sources = response.candidates[0].groundingMetadata.groundingChunks
        .map((chunk: any) => chunk.web)
        .filter((web: any) => web && web.uri && web.title);
    }

    const textOutput = response.text;

    if (!textOutput) {
        throw new Error("Model returned no output. It might have failed to use the search tool.");
    }

    return { 
      output: textOutput,
      sources: sources.length > 0 ? sources : undefined
    };
  } catch (error: any) {
    console.error(`Error executing step ${step.id}:`, error);
    let errorMessage = error.message || "Unknown error occurred";
    if (errorMessage.includes("400")) {
        errorMessage += " (Bad Request - possibly invalid tool usage)";
    }
    throw new Error(errorMessage);
  }
};