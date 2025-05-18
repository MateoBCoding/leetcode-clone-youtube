import Topbar from "@/components/Topbar/Topbar";
import Workspace from "@/components/Workspace/Workspace";
import useHasMounted from "@/hooks/useHasMounted";
import { firestore } from "@/firebase/firebase";
import { problems } from "@/utils/problems";
import { Problem } from "@/utils/types/problem";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import React from "react";

type ProblemPageProps = {
	problem: Problem;
};

const ProblemPage: React.FC<ProblemPageProps> = ({ problem }) => {
	const hasMounted = useHasMounted();

	if (!hasMounted) return null;

	return (
		<div>
			<Topbar problemPage />
			<Workspace problem={problem} />
		</div>
	);
};
export default ProblemPage;


export async function getStaticPaths() {
    const querySnapshot = await getDocs(collection(firestore, "problems"));
    const paths = querySnapshot.docs.map(doc => ({
        params: { pid: doc.id },
    }));

    return {
        paths,
        fallback: false,
    };
}


export async function getStaticProps({ params }: { params: { pid: string } }) {
    const { pid } = params;

    const docRef = doc(firestore, "problems", pid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        return { notFound: true };
    }

    const problemData = docSnap.data();


    const problem = {
        ...problemData,
    };

    return {
        props: {
            problem,
        },
    };
}