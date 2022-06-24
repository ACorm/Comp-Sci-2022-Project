sIds={};

async function loadMain(){
	var app = angular.module('app', []);
	await app.controller('controller', loadValues);
	app.directive("classList", function(){
		return {
			template : `<dl ng-repeat="classId in classIds" id='subjects'>
				<dt>
					<span class="del_button">x</span>
					<h3>{{classInfo.classNames[classId]}}</h3>
					<h6>{{classId}}</h6>
				</dt>
				<dd>
					<table>
						<thead>
							<tr>
								<th class="table_head">Student Id</th>
								<th class="table_head">Name</th>
								<th class="table_head">Email</th>
							</tr>
						</thead>
						<tbody ng-repeat="student in classInfo.classes[classId]">
							<tr>
								<td><a
								href=/edit.html?sId={{student.studentId}}&cId={{classId}}>
								{{student.studentId}}</a></td>
								<td>{{student.name}}</td>
								<td>{{student.email}}</td>
								<td>
									<span class="del_student_button">x</span>
								</td>
							</tr>
						</tbody>
					</table>
					<div>
						<input ng-model=sIds.classId placeholder="Student Id">
						<button ng-click="addStudent()">Add Student</button>
					</div>
				</dd>
			</dl>`
		};
	});
}

async function loadValues($scope){
	
	try{
		//Get teacher class info
		var classInfo = await fetch('/classes',{
			method:'Post',
			headers:{
				'Accept' : 'application/json',
				'Content-Type' : 'application/json'
			}
		});
		
		//Get json
		classInfo=await classInfo.json();
		
		
		$scope.classInfo=classInfo;
		$scope.classIds=Object.keys(classInfo.classNames);
		$scope.$apply();
	
	}catch(e){
		//**todo implement error handling
		console.log("Uh Oh");
		console.error(e);
	}
}

async function loadClasses($scope){
	
	try{
		//Get teacher class info
		var classInfo = await fetch('/classes',{
			method:'Post',
			headers:{
				'Accept' : 'application/json',
				'Content-Type' : 'application/json'
			}
		});
		
		//Get json
		classInfo=await classInfo.json();
		
		
		//$scope.classes=classInfo;
		
		$scope.classes = "Hello";
		
		console.log(classInfo);
		
		console.log("Hey");
		
	
		var list=document.getElementById('subjects');
	
		//Get the template element
		var template=document.querySelector('#class_table')
	
		//Iterate through each class adding it to the html dl
		for (let classId in classInfo.classNames){
		
			//Clone the template
			var class_section=template.content.cloneNode(true);
		
			//Set the Class title
			var class_title=class_section.querySelector('#class_name')
			let heading1=class_title.childNodes[3];
			let heading2=class_title.childNodes[5];
			heading1.innerHTML=classInfo.classNames[classId];
			heading2.innerHTML=classId;
			class_title.setAttribute('id','title_'+classInfo.classNames[classId])
			
			//Set the button and input
			var input=class_section.querySelector('#newStudent_input')
			input.setAttribute('id','input_'+classInfo.classNames[classId])
			var button=class_section.querySelector('#student_button')
			button.onclick=function() {addStudent('input_'+classInfo.classNames[classId],classId)}
			
			//Set the Delete class X button
			let del_button=class_section.querySelector('#del_button')
			del_button.onclick=function() {delClass(classInfo.classNames[classId],classId)}
			
			//Get the student table element
			var student_table=class_section.querySelector('#main_body')
			
			//Add students to table
			for (let student of classInfo.classes[classId]){
			
				var row=student_table.insertRow();
				
				//Link the name cell to a editor page(/edit)
				let name_cell=document.createElement('td');
				let link=document.createElement('a');
				link.setAttribute('href',`/edit.html?sId=${student.studentId}&cId=${classId}`);
				let name_text=document.createTextNode(student.studentId);
				link.appendChild(name_text);
				name_cell.appendChild(link);
				row.appendChild(name_cell);
				
				//Set the text in name and email
				for (var value of ['name','email']){
					var cell=document.createElement('td');
					var text=document.createTextNode(student[value]);
					cell.appendChild(text);
					row.appendChild(cell);
				}
				
				//Sets the delete student button
				var cell=document.createElement('td');
				var delStudentButton=document.createElement('span');
				delStudentButton.addEventListener('click',function(){delStudent(''+student.studentId,classId)})
				//delStudentButton.setAttribute('click',function(){delStudent(student.studentId,classId)})
				delStudentButton.setAttribute('class','del_student_button')
				delStudentButton.innerHTML='x';
				cell.appendChild(delStudentButton);
				row.appendChild(cell);
			}
			
			
			//Add the Class to the List
			list.appendChild(class_section);
		}
	}catch(e){
		
		if(classInfo.status==500){
			
			//Possible that the user is signed out			
			//**Done inform the user of what went wrong
			alert('Please sign out and back in as there was a problem identifying who you are loged in as.');
			
		}else{
			
			//An unexpected error occured
			console.error(e);
		}
		
	}
}

async function addStudent(classId){
	console.log("Function called");
	//console.log(input_id)
	console.log(classId)
	//var studentId=document.getElementById(input_id).value
	let studentId=sIds.classId;
	console.log(studentId);
	//Adds a student
	try{
		
		/*var add_student_res=await (await fetch('/addStudent',{
			method:'Post',
			headers:{
				'Accept' : 'application/json',
				'Content-Type' : 'application/json'
			},
			body:JSON.stringify({'studentId':studentId,'classId':classId})
		}));*/
		
		//location.reload();
	}catch(e){
		
	}
}

async function addClass(){
	console.log('Adding Class')
	
	var className=document.getElementById('className')
	var classId=document.getElementById('classId')
	
	try{
		
		var add_class_res=await fetch('/newClass',{
			method:'Post',
			headers:{
				'Accept' : 'application/json',
				'Content-Type' : 'application/json'
			},
			body:JSON.stringify({'className':className.value,'classId':classId.value})
		});
		
		
		if(!add_class_res.ok){
			throw new Error();
		}else{
			console.log('Class added')
			//location.reload();
		}
	}catch(e){
		
		//Reset invalidity
		className.setCustomValidity('');
		classId.setCustomValidity('');
		
		if(add_class_res.status==500){
			//Teacher does not exist
			alert('The server could not verify who you are. Please sign out and back in.')
			
		}else if(add_class_res.status==400){
			
			//Get json
			add_class_res=await add_class_res.json();
			if(add_class_res.code==401){
				//Duplicate Class Name
				className.setCustomValidity('Class Name already used. Please add the block or other information to clarify between classes.');
			
			}else if(add_class_res.code==402){
				//Duplicate Class Id
				classId.setCustomValidity('Class Id already in use.');
			
			}else if(add_class_res.code==403){
				//Duplicate Class Name and Class Id
				className.setCustomValidity('Class Name already used. Please add the block or other information to clarify between classes.');
				classId.setCustomValidity('Class Id already in use.');
				
			}else{
				//Unknown error code
				console.error(e);
			}
			
			await className.reportValidity();
			await classId.reportValidity();
		}else{

			//Unaccounted error occured
			console.error(e);
		}
	}
}

async function delClass(className,classId){
	//Check to make sure the user is sure
	if(confirm('Warning!! You are about to delete your '+className+' class. This action cannot be undone.')){
	
		console.log('deleting Class')
	
		var add_class_res=await (await fetch('/delClass',{
			method:'Post',
			headers:{
				'Accept' : 'application/json',
				'Content-Type' : 'application/json'
			},
			body:JSON.stringify({'className':className,'classId':classId})
		}));
		
		location.reload();
	}
}

async function delStudent(studentId,classId){
	//Check to make sure the user is sure
	if(confirm('Warning!! You are about to permanently remove this student from your class. This action cannot be undone.')){
	
		console.log('removing student')
	
		var add_class_res=await (await fetch('/delStudent',{
			method:'Post',
			headers:{
				'Accept' : 'application/json',
				'Content-Type' : 'application/json'
			},
			body:JSON.stringify({'studentId':studentId,'classId':classId})
		}));
		
		location.reload();
	}
}