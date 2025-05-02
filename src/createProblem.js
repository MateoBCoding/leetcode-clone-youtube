const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// Inicializa Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const firestore = admin.firestore();

// Define el problema
const problemData = {
    id: "two-sum",
    title: "1. Two Sum",
    problemStatement: `<p class='mt-3'>
        Given an array of integers <code>nums</code> and an integer <code>target</code>,
        return <em>indices of the two numbers such that they add up to</em> <code>target</code>.
    </p>
    <p class='mt-3'>
        You may assume that each input would have <strong>exactly one solution</strong>,
        and you may not use the same element twice.
    </p>
    <p class='mt-3'>You can return the answer in any order.</p>`,
    examples: [
        {
            id: 1,
            inputText: "nums = [2,7,11,15], target = 9",
            outputText: "[0,1]",
            explanation: "Because nums[0] + nums[1] == 9, we return [0, 1].",
        },
        {
            id: 2,
            inputText: "nums = [3,2,4], target = 6",
            outputText: "[1,2]",
            explanation: "Because nums[1] + nums[2] == 6, we return [1, 2].",
        },
        {
            id: 3,
            inputText: "nums = [3,3], target = 6",
            outputText: "[0,1]",
            explanation: "",
        },
    ],
    constraints: `
        <li class='mt-2'><code>2 ≤ nums.length ≤ 10</code></li>
        <li class='mt-2'><code>-10 ≤ nums[i] ≤ 10</code></li>
        <li class='mt-2'><code>-10 ≤ target ≤ 10</code></li>
        <li class='mt-2 text-sm'><strong>Only one valid answer exists.</strong></li>
    `,
    starterCode: `function twoSum(nums, target) {\n  // Write your code here\n};`,
    starterFunctionName: "function twoSum(",
    order: 1,
    difficulty: "Easy",
    category: "Array",
    link: "",
    videoId: "8-k1C6ehKuw",
    testCases: [
        { input: "[2,7,11,15],9", output: "[0,1]" },
        { input: "[3,2,4],6", output: "[1,2]" },
        { input: "[3,3],6", output: "[0,1]" },
    ],
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
