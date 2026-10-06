import {currentUser} from "@/data/users";

const canSwitchRole = currentUser.role.includes("Parent") && currentUser.role.includes("Teacher");

{canSwitchRole && ( 

    <button onClick = {() => router.push("/teacher")} >
        Switch to Teacher 
    </button>



)}