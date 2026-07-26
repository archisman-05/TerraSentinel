const OpenAI = require("openai");

const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
});

async function callAI(prompt) {
    const completion = await client.chat.completions.create({
        model: "openrouter/auto",
        messages: [
            {
                role: "system",
                content:
                    "You are TerraSentinel AI, an expert disaster management and NGO resource allocation assistant. Always return ONLY valid JSON."
            },
            {
                role: "user",
                content: prompt
            }
        ],
        temperature: 0.3
    });

    let response = completion.choices[0].message.content;

    response = response
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    try {
        return JSON.parse(response);
    } catch (err) {
        console.error("Invalid AI JSON:", response);
        throw new Error("AI returned invalid JSON");
    }
}

// =======================================================
// Disaster Analysis
// =======================================================

async function analyzeDisaster(data) {

    const prompt = `
You are TerraSentinel AI.

Analyze this environmental data.

Weather
Temperature: ${data.temperature} °C
Rainfall: ${data.rain} mm
Humidity: ${data.humidity} %
Wind Speed: ${data.wind} km/h

Terrain
Elevation: ${data.elevation}
Road Count: ${data.roadCount}

Return ONLY JSON

{
  "riskScore":0,
  "riskLevel":"",
  "confidence":0,
  "disasterType":"",
  "recommendedVolunteers":0,
  "recommendedMedicalTeams":0,
  "recommendedFoodKits":0,
  "recommendedBoats":0,
  "expectedResponseTime":"",
  "immediateActions":[],
  "reasoning":[],
  "summary":""
}
`;

    return await callAI(prompt);
}

// =======================================================
// Area Insights
// =======================================================

async function generateAreaInsights(data) {

    const prompt = `
You are TerraSentinel AI.

Analyze this area.

${JSON.stringify(data, null, 2)}

Return ONLY JSON.

{
    "riskScore":0,
    "priority":"",
    "summary":"",
    "recommendations":[
        "",
        "",
        ""
    ]
}
`;

    return await callAI(prompt);
}

// =======================================================
// Central Reports
// =======================================================

async function generateCentralInsights(data) {

    const prompt = `
You are TerraSentinel AI.

You are an emergency management analyst working for a national disaster response center.

Analyze the NGO operational data below.

Data:
${JSON.stringify(data, null, 2)}

Your task is to perform a complete operational analysis.

Think like a disaster management officer.

Return ONLY valid JSON.

{
  "overallSituation": "",
  "riskLevel": "",
  "summary": "",
  "topPriorityLocations": [
    {
      "location": "",
      "reason": "",
      "priority": ""
    }
  ],
  "resourceForecast": {
    "expectedReportsNext30Days": 0,
    "expectedVolunteerRequirement": 0,
    "expectedMedicalTeams": 0,
    "expectedFoodKits": 0
  },
  "recommendations": [
    {
      "title": "",
      "description": "",
      "urgency": ""
    }
  ],
  "futureThreats": [
    ""
  ],
  "confidence": 0
}
`;

    return await callAI(prompt);
}

// =======================================================
// Weekly Summary
// =======================================================

async function generateWeeklySummary(data) {

    const prompt = `
You are TerraSentinel AI.

Generate a professional NGO operations report for this week's disaster response.

Analyze:
- completed tasks
- pending tasks
- volunteer activity
- NGO performance
- disaster trends
- recurring locations
- resource shortages
- future workload

Data:

${JSON.stringify(data, null, 2)}

Return ONLY JSON.

{
   "summary":"",
   "majorEvents":[
   ],
   "performanceAnalysis":"",
   "resourceUsage":"",
   "criticalFindings":[
   ],
   "recommendations":[
   ],
   "nextWeekForecast":"",
   "confidence":0
}
`;

    return await callAI(prompt);
}

module.exports = {
    analyzeDisaster,
    generateAreaInsights,
    generateCentralInsights,
    generateWeeklySummary,
};