const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// Inicializa Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const firestore = admin.firestore();

const problemData = {
    id: "max-subarray",
    title: "2. Maximum Subarray",
    problemStatement: `<p class='mt-3'>
        Given an integer array <code>nums</code>, find the contiguous subarray (containing at least one number) which has the largest sum and return its sum.
    </p>
    <p class='mt-3'>
        A subarray is a contiguous part of an array.
    </p>`,
    examples: [
        {
            id: 1,
            inputText: "nums = [-2,1,-3,4,-1,2,1,-5,4]",
            outputText: "6",
            explanation: "The subarray [4,-1,2,1] has the largest sum = 6."
        },
        {
            id: 2,
            inputText: "nums = [1]",
            outputText: "1",
            explanation: "Only one element."
        },
        {
            id: 3,
            inputText: "nums = [5,4,-1,7,8]",
            outputText: "23",
            explanation: "Whole array has positive sum."
        }
    ],
    constraints: `
        <li class='mt-2'><code>1 ≤ nums.length ≤ 10<sup>5</sup></code></li>
        <li class='mt-2'><code>-10<sup>4</sup> ≤ nums[i] ≤ 10<sup>4</sup></code></li>
    `,
    starterCode: `function maxSubArray(nums: number[]): number {\n  // Write your code here\n}`,
    starterFunctionName: "function maxSubArray(",
    order: 2,
    difficulty: "Medium",
    category: "Array",
    link: "",
    videoId: "",
    testCases: [
        { input: "[-2,1,-3,4,-1,2,1,-5,4]", output: "6" },
        { input: "[1]", output: "1" },
        { input: "[5,4,-1,7,8]", output: "23" }
    ]
};

async function createProblem() {
    try {
        const docRef = firestore.collection("problems").doc(problemData.id);
        await docRef.set(problemData);
        console.log(`✅ Documento '${problemData.id}' creado/actualizado exitosamente.`);
        process.exit(0);
    } catch (error) {
        console.error("❌ Error creando el documento:", error);
        process.exit(1);
    }
}

createProblem();
