const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// Inicializa Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const firestore = admin.firestore();

const courseData = {
    title: "Curso de Programación Básica",
    description: "Un curso de 3 días para practicar problemas esenciales de algoritmos.",
    category: "Programación",
    days: [
        {
            day: 1,
            problems: ["two-sum", "reverse-string"],
        },
        {
            day: 2,
            problems: ["palindrome-number", "valid-parentheses"],
        },
        {
            day: 3,
            problems: ["merge-two-sorted-lists", "remove-duplicates"],
        },
    ],
};

async function createCourse() {
    try {
        const newCourseRef = firestore.collection("courses").doc(); // genera un ID único
        await newCourseRef.set(courseData);
        console.log(`✅ Curso '${courseData.title}' creado exitosamente con ID: ${newCourseRef.id}`);
        process.exit(0);
    } catch (error) {
        console.error("❌ Error creando el curso:", error);
        process.exit(1);
    }
}

createCourse();
