async function toHex(intArray,padding){
	//Maps each number in the bytes to hex then join them together
	/*Code sourced from
	https://stackoverflow.com/questions/21647928/javascript-unicode-string-to-hex
	Simon Buchan*/
	return Array.from(intArray, byte => byte.toString(16).padStart(padding,"0")).join('')
}

async function signUp(){
	
	var username=document.getElementById('username').value;
	var password=document.getElementById('password').value;
	var teacherId=document.getElementById('teacherId').value;
	
	if(
		!username.match('(?=.{5,})') ||
		!teacherId.match('T[0-9]{6}') || 
		!password.match('(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.{8,})')
	){
		if(!username.match('(?=.{5,})')){
			let name = document.getElementById('username');
			name.setCustomValidity("Your Username must be at least 5 chracters long");
			name.reportValidity();
		}
		if(!password.match('(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.{8,})')){
			let pass = document.getElementById('password');
			pass.setCustomValidity("Your Password must be 8 characters long and contain 1.\n -Number(0-9)\n -Lowercase Letter (a-z)\n -Upercase Letter (a-z)\n -Special Character (!, @, #, $, %, ^, &, *)");
			pass.reportValidity();
		}
		if(!teacherId.match('T[0-9]{6}')){
			let tId = document.getElementById('teacherId');
			tId.setCustomValidity("Your Teacher Id must be a 6 digit number with a T at the start.");
			tId.reportValidity();
		}
		return
	}
	
	//Randomize salt
	var salt=window.crypto.getRandomValues(new Uint32Array(16));
	
	//**todo Error checking/invalid request
	
	
	//Generate a hash
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
	salt = await toHex(salt, 8)
	
	if(salt=='' || hash=='' || username=='' || teacherId==''){
		alert('Please do not leave any field empty')
		throw new Error('Invalid credentials')
	}
	
	try{
		//Get response
		var response = await fetch('/newUser',{
			method:'Post',
			headers:{
				'Accept' : 'application/json',
				'Content-Type' : 'application/json'
			},
			body:JSON.stringify({'newId':teacherId,'username':username,'hash': hash,'salt':salt})
		});
	
		response=await response.json();
	
		if(response.url!=null){
			window.location.replace(response.url);
		}else{
			//**todo show error did not sign up
		}
	}catch(e){
		
		let tId=document.getElementById('teacherId');
		
		
		if(response.status==400){
			
			//If the request was unsuccesful inform the user
			tId.setCustomValidity("Teacher Id already in use");
		}else{
			
			//Raise the error
			console.error(e);
		}
		
		//Report Validity
		tId.reportValidity();
	}
}