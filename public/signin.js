async function toHex(intArray,padding){
	//Maps each number in the bytes to hex then join them together
	/*Code sourced from
	https://stackoverflow.com/questions/21647928/javascript-unicode-string-to-hex
	Simon Buchan*/
	return Array.from(intArray, byte => byte.toString(16).padStart(padding,"0")).join('')
}

async function fromHex(hexString){
	//Matches each chunk and converts it to an int
	/*Code sourced from
	https://stackoverflow.com/questions/38987784/how-to-convert-a-hexadecimal-string-to-uint8array-and-back-in-javascript
	Jason Dreyzehner*/
	return Uint32Array.from(hexString.match(/.{1,8}/g).map((byte) => parseInt(byte, 16)));
}

async function signIn(){
	console.log('Sending request')
	
	//Gets the values for the input form
	var teacherId=document.getElementById('teacherId').value
	var username=document.getElementById('username').value
	let password = document.getElementById('password').value
	
	//**todo Error checking/invalid request before calling server
	
	
	
	try{
		
		//Get Server Recency Info
		//Get User salt info
		var recency = await fetch('/salt',{
			method:'Post',
			headers:{
				'Accept' : 'application/json',
				'Content-Type' : 'application/json'
			},
			body:JSON.stringify({'teacherId':teacherId})
		});
		
		//Get the json
		recency=await recency.json();
		
		//Decode the salt and generate a hash
		let salt = await fromHex(recency.salt)
		
		let keyValue = await window.crypto.subtle.importKey(
		'raw', 
		new TextEncoder().encode(username+password),
		{'name': 'PBKDF2'},
		false,
		['deriveBits']
		)
		
		var hash = await window.crypto.subtle.deriveBits(
		{
			'name': "PBKDF2",
			'salt': salt,
			'iterations': 10000,
			'hash': "SHA-512"
		},
		keyValue,
		64
		);
		hash = await toHex(new Uint8Array(hash), 2)
	
	
	
		//Send Post Req to Server
		var response=await fetch('/signin',{
			method:'POST',
			headers:{
				'Accept' : 'application/json',
				'Content-Type' : 'application/json'
			},
			body:JSON.stringify({'teacherId':teacherId,'username' : username,'hash' : hash, 'salt' : recency.salt})
		});
		
		//Get the json
		response=await response.json();
	
		if(response.url!=null){
			window.location.replace(response.url)
		}else{
			//**Done show error did not sign in(unknown cause)
			alert("There was an unexpected error and you were not signed in. Please close the tab and reopen it in a new window.");
		}
	}catch(e){
		
		let tId=document.getElementById('teacherId');
		let username=document.getElementById('username');
		let password=document.getElementById('password');
		
		//Clear invalid status
		tId.setCustomValidity("");
		username.setCustomValidity("");
		password.setCustomValidity("");
		
		
		
		if(recency!=null && recency.status==400){
			
			//If the request was unsuccesful inform the user
			tId.setCustomValidity("Teacher Id does not exist.");
		}else if(response!=null && response.status==400){
			
			//If the request was unsuccesful inform the user
			username.setCustomValidity("Username or Password Incorrect");
			password.setCustomValidity("Username or Password Incorrect");
		}else if(response!=null && response.status==500){
			
			//Internal Server Error
			alert('There was an unexpected error on our end. Please try again in a few minutes');
		}else{
			
			//Else log the error
			console.error(e);
		}
		
		//Report Validity
		tId.reportValidity();
		username.reportValidity();
		password.reportValidity();
	}
}