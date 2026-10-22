import Consent from './consent';
export const dynamic='force-dynamic';
export default function ConsentPage(){
 return <Consent clientId={process.env.MCP_CLIENT_ID??''} callback={process.env.MCP_REDIRECT_URI??''}/>;
}
