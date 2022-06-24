var termPeriod = 0;
var termNames = ['1st','2nd','3rd']
var keys = [
'percentageMark',
'responsibility',
'organzation',
'independantWork',
'collaboration',
'initiative',
'selfRegulation']

async function getQueryInfo(){
	let queries=window.location.search.slice(1).split('&');
	//Sets empty dictionary values to list of key value pairs
	let info=Object.assign({},...queries.map(function(x) {
		keyPair=x.split('=');
		return ({[keyPair[0]] : keyPair[1]});
	}));
	return info;
}

async function load_report(){
	//Get Query Params
	var qInfo=await getQueryInfo();

	studentId=qInfo['sId'];
	classId=qInfo['cId'];
	
	
	try{
		
		//Get Report card
		var report = await fetch('/report',{
			method:'Post',
			headers:{
				'Accept' : 'application/json',
				'Content-Type' : 'application/json'
			},
			body:JSON.stringify({'classId':classId,'studentId':studentId})
		});
		//Get json
		if(!report.ok){
			throw new Error();
		}
		report = await report.json();
		
		
		//Get the student
		var student=await fetch('/student',{
			method:'Post',
			headers:{
				'Accept' : 'application/json',
				'Content-Type' : 'application/json'
			},
			body:JSON.stringify({'studentId':studentId})
		});
		//Get student
		if(!student.ok){
			throw new Error();
		}
		student=await student.json();
		
		
		//Set the student title
		var student_title=document.getElementById('student_name');
		student_title.innerHTML=student.name;
		
		
		//Get the body and term report template
		var report_table_body=document.getElementById('body');
		var template=document.querySelector('#term_report')
		
		
		//Sets the current term reporting period
		termPeriod=report.data.length-1;
		
		
		//Setup Comment box
		var comment=document.getElementById('comment');
		comment.innerHTML=report.data[termPeriod].comment;
		
		//Iterate through each term in the report
		for (var term in report.data){
			
			//Get the row template and sets its ID to the term
			var row=template.content.cloneNode(true);
			row.querySelectorAll('tr')[0].setAttribute('id',term);
			
			//Sets the term period to the term
			var items=row.querySelectorAll('td')
			items[0].textContent=termNames[term];
			
			//If it is the current term (The editable term)
			if(term==termPeriod){
				
				//Iterate through the inputs (responsibility...)
				for (var i=0;i<7;i++){
					let input=document.createElement('input')
					input.value=report.data[term][keys[i]]
					input.placeholder=report.data[term][keys[i]]
					input.setAttribute('id',keys[i])
					input.setAttribute('class','term_input')
					
					//If the first input is a percent (number) setup the restrictions
					if(i==0){
						input.setAttribute('type','number')
						
						//Allows for the input of values between 0 and 100
						input.oninput=function (){
							this.value = this.value>100?100:(this.value<0?0:this.value);
						}
					}else{
						//Else only allow letter values
						input.setAttribute('type','text')
						
						
						//Allows input of E, G, S, or N
						//If an invalid character like 1 is entered it clears the value
						//If two characters are entered like SG then it takes the last value
						input.oninput=function(){
							characterDict={'E':'E','G':'G','S':'S','N':'N','e':'E','g':'G','s':'S','n':'N'};
							this.value=this.value[this.value.length-1]
							this.value = (this.value in characterDict)?characterDict[this.value]:'';
						}
					}
					
					//Add the input to the list
					items[i+1].appendChild(input)
				}
			}else{
				
				//If it is a normal (static row) set the element values
				for (var i=0;i<7;i++){
					items[i+1].textContent=report.data[term][keys[i]];
				}
			}
			
			//Add the row to the table
			report_table_body.appendChild(row);
		}
	}catch(e){
		//**todo implement switch cases for more modularity
		if(report != null && !report.ok){
			if(report.status == 500){				
				report = await report.json()
				//There was an unexpected error with loading the report
				await alert('This report was unable to be retrieved. The page will be automatically reloaded.');
				location.reload();
			}else if(report.status == 400){
				report = await report.json()
				if(report.code == 401){
					alert('This school year has finished and you are no longer able to view or edit this report. See you next year.')
					window.location.replace('/view.html')
				}
			}
		}else if(student != null && student.status==500){
			//The student could not be found
			await alert('The student you were looking for could not be found. The page will be automatically reloaded.');
			location.reload();
			
		}else{
			
			//An unexpected error occured
			console.error(e);
		}
	}
}

async function submitTerm(){
	//Submits/Saves the term info
	
	if(confirm('Saving marks')){
	
		//the dictionary to store the report data
		let data={};
	
		//Get all the different input values(Could use class to get them instead)
		let rowInput=document.getElementById(termPeriod);
		let rowElements=rowInput.querySelectorAll('td');
		for (let elementIndex=1;elementIndex<=7;elementIndex++){
			element=rowElements[elementIndex].firstChild;
			data[element.getAttribute('id')]=element.value;
		}
	
		//Add the comment in
		data['comment']=document.getElementById('comment').innerHTML;
	
		var response = await (await fetch('/updateReport',{
			method:'Post',
			headers:{
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			body:JSON.stringify({
				'studentId':studentId,
				'classId':classId,
				'reportingPeriod': termPeriod,
				'data': data})
		}));
		
		location.reload();
	}
}

async function signOut(){
	//Contacts the server to disconnect the client and awaits a response
	let response = await (await fetch('/signOut',{
		method:'Post',
		headers:{
			'Accept' : 'application/json',
			'Content-Type' : 'application/json'
		}
	}));
		
	if(response.status==500){
		//todo? sign user out different way
	}else if(response.status==400){
		window.location.replace("/");
	}
}