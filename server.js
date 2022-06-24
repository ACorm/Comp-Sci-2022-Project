//Required imports
const http = require('http');
const fs = require('fs');
const express = require('express');
const { MongoClient } = require('mongodb');
const session = require('express-session');
const mongoStore = require('connect-mongo');
const crypto = require('crypto');

//Required connections
const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);
const app = express();
const Port=8080;

//RegExp
const usernameRegExp = new RegExp('(?=.{5,})');
const teacherRegExp = new RegExp('T[0-9]{6}');

/*Error codes
newUser / 401- 'Invalid teacherId'
		/ 402-

newClass/ 401- 'Duplicate Class Name'	
		/ 402- 'Duplicate Class Id'
		/ 403- 'Duplicate Class'

report	/ 401- 'Year has ended'
*/




//Get Current Reporting Period and class Year
//November, February, June
const reportingPeriods = [[0,11,23],[1,2,10],[1,7,6]]
const reportPeriodIndex = ['1st','2nd','3rd'];
const endOfYear = 4;

//Returns the school year and reporting period
async function getShiftedDate(){
	/*Gets Today and shifts it back 8 months
	This ensures that all dates from Sept(9) to June(6)
	stay within the same year*/
	let today = new Date();
	let shiftedDate=new Date(today.getFullYear(),today.getMonth()-8,today.getDate()-9);
	return shiftedDate;
}
async function getYear(){
	//Gets the year of the shifted date
	//This school year will always be the first year
	//(ex. 2022-2023 year == 2022)
	let val=(await getShiftedDate()).getFullYear();
	return val;
}
async function getReportingPeriod(){
	/*Gets today and the year
	Then it sets the reporting periods to the proper year
	It then sorts today in to the list and finds where it lies
	This index+1 is the reporting period*/
	let today=new Date();
	let year=await getYear();
	let reportDates=reportingPeriods.map(d => 
		new Date(year+d[0],d[1]-1,d[2]));
	reportDates.push(today);
	reportDates=reportDates.sort((a,b) => a.getTime()-b.getTime());
	return 1+reportDates.indexOf(today);
}


//Student and teacher classes

//These classes are never used although they explain parts of the program
class Teacher{
	
	//A simple data model for teachers
	constructor(user_data){
		this.username=user_data['username'];
		this.salt=user_data['salt'];
		this.hash=user_data['hash'];
		this.teacherId=user_data['teacherId'];
		//map <classId(String)> -> <students(List<studentId(String)>)>
		this.classes=user_data['classes'];
		//map <classId(String)> -> <className(String)>
		this.classNames=user_data['classNames'];
		//List <className(String)>
		this.namesList=Object.keys(user_data['classNames']).map(key => user_data['classNames'][key])
	}
	
	addClass(className,classId){
		//todo check for no duplicate class names
		//If the class dosen't exist adds a Class to teachers classes
		if(!(classId in this.classes) && !(classId in this.classNames)){
			this.classes[classId]=[];
			this.classNames[classId]=className;
			this.namesList.push(className);
		}else{
			//todo proper error handling
			//throw Exception();
		}
	}
	
	addStudent(classId,studentId){
		//Adds a student to a specific class if it exists
		//todo check if student exists (if not create them?)
		if((classId in this.classes) && !(studentId in this.classes[classId])){
			this.classes[classId].push(studentId);
		}
		//Add Class on Student end
	}	
}

class Student{
	//A simple student data model
	constructor(studentId,name,email){
		//stores Student Id, Name, and Email
		this.studentId=studentId;
		this.name=name;
		this.email=email;
	}
}

class Report{
	//A simple report card data model
	constructor(studentId,teacherId,classId){
		this.studentId=studentId;
		this.classId=classId;
		this.teacherId=teacherId;
		this.data=[];
		this.finalized=false;
		this.year='2021';
	}
	
	addTerm(name){
		if (!(name in this.data)){
			this.data[name]={};
		}
	}
	
	addTermReport(report_data){
		this.data.push(report_data);
	}
}



//Middleware

//Middleware for session storage using connect-mongo
app.use(session({
	secret: "It's a secret to no one",
	store: mongoStore.create({
		mongoUrl: uri
	}),
	cookie: {
		maxAge: 2*60*60*1000 //2 Hours
	}
}));

//Middleware for Json and url processing
app.use(express.urlencoded());
app.use(express.json());

//Middleware for redirecting to sign in if the user is not signed in
app.use(function(req,res,next){
	if(req.session.teacherId){
		next();
	}else{
		if(['/signin','/signup','/','/salt','/newUser','/index','/package','/crypt'].includes(req.url.split('.')[0])){
			next();
		}else{
			console.log(req.url);
			console.log('-Redirecting User-');
		return res.redirect('/signin.html');
		};
	};
});

//todo Authenticate user middleware

//Middleware for static page loading
app.use(express.static(__dirname+'/public'));

//**todo? specify proper response codes

//Client side request handling

//Sign in Requests
app.post('/salt',async function (req,res){
	console.log('/salt')

	try{
		await client.connect();
		
		//Gets the teacher salt from the database
		var resp=await client
		.db('schoolsitedb')
		.collection('teachers')
		.findOne(
			{'teacherId':req.body.teacherId},
			{'salt':true}
		);
		
		if(resp!=null){
			console.log('\tTeacher found')
			//Returns the salt to the user
			res.send(JSON.stringify({'salt':resp.salt}));
		}else{
			console.log('\tTeacher not found')
			//**Done Inform the user that the account TeacherId does not exists
			
			//Sets the response status to 400 Bad Request 
			res.status(400);
			res.send();
			
			//Todo return error message(or have error message be sent by /signIn)
			//The User Account Does not exist return error
			//Possible Problem this might allow people to check which teacherIds exist
			//Although it still leaves the username uneffected
		}
	}finally{
		client.close()
	}
});
app.post('/signin',async function(req,res){
	console.log('/signIn');
	
	if(req.body.hash!=null 
	&& req.body.salt!=null
	&& req.body.username!=null){
	
	//**Done ******Don't Crash server when sent invalid teacherId
	
	//Hash the recieved values
	let hash = crypto.pbkdf2Sync(req.body.hash, req.body.salt, 10000, 64, 'sha512').toString('hex');
	
		//**Done check if already signed in and sign that user out
	
		//Compares hash to hash of user's inputed info
		try {
			await client.connect();
			
			//Gets the teacher acount from the database
			let teacher=await client
			.db('schoolsitedb')
			.collection('teachers')
			.findOne(
			{'teacherId':req.body.teacherId});
			
			if(teacher!=null){
				if(teacher.username==req.body.username && teacher.hash==hash){
					console.log('\tValid entry');
					console.log('\tSigning in');
					
					//Set session variable
					req.session.teacherId=req.body.teacherId;
					
					
					
					//Respond with redirect url
					res.send(JSON.stringify({'url':'/view.html'}));
				}else{
					console.log('\tInvalid entry');
					//**Done Inform the user that they have an invalid username or password
					
					//**todo? Add in wait time (to avoid password guessing)
					
					//Sets the response status to 400 Bad Request 
					res.status(400);
					res.send();
					
				}
			}else{
				//**Done make apropriate response
				//Server Error
				console.log("\tTeacher Not Found")
				
				res.status(500);
				res.send();
			}
			
		}finally{
			client.close();
		}
	}
});

//Sign up Requests
app.post('/newUser',async function(req,res){
	console.log('/newUser');
	
	//**Done Error checking/invalid request
	if(req.body.hash!=null 
	&& req.body.salt!=null
	&& usernameRegExp.test(req.body.username)
	&& teacherRegExp.test(req.body.newId)){
	
		try{
	
			//Computes the Hash of given values
			let hash = crypto.pbkdf2Sync(req.body.hash, req.body.salt, 10000, 64, 'sha512').toString('hex');
		
			//Recieves: teacherId, username, hash, salt
		
			//Connect
			await client.connect();
		
			//Create a teacher object
			let teacher={
				'teacherId':req.body.newId,
				'username':req.body.username,
				'hash':hash,
				'salt':req.body.salt,
				'classes':{},
				'classNames':{},
				'namesList': []
			}
			
			//Check if the user is already in the system and store it in the database
			var result=await client
				.db('schoolsitedb')
				.collection('teachers')
				.updateOne(
					{'teacherId':teacher['teacherId']},
					{$setOnInsert:teacher},
					{upsert:true}
				);
			
			//Repond to user if succesful or not
			if(result.matchedCount==0){
				console.log('\tNew user created');
				
				//sets the session state
				req.session.teacherId=req.body.newId;
				
				res.send(JSON.stringify({'url':'/view.html'}));
			}else{
				console.log('\tUser already exists');
				//Send Error/Did not work
				
				//**Done Inform the user that the account TeacherId already exists
				//Set the response status and send
				res.status(400);	
				res.send();
			}
		}finally{
			client.close();	
		}
		
	}else{
		console.log("Failed Test (Invalid account)");
		//**todo? Done (Checks on front end (if the user bypasses the system they know what their doing)) Return Proper error for invalid choice
	}
});

//Sign out Requests
app.post('/signOut', async function(req,res){
	console.log('/signOut');
	
	try{
		req.session.destroy();
		res.status(400);
	}catch(e){
		res.status(500);
	}finally{
		res.send();
	}
	
})


//Teacher Data Requests
app.post('/classes',async function(req,res){
	console.log('/classes')
	try{
		await client.connect();
		
		//Access the teacher from the database
		var teacher=await client
		.db('schoolsitedb')
		.collection('teachers')
		.findOne(
		{'teacherId':req.session.teacherId});
		
		//If the report exists
		if(teacher!=null){
			console.log('\tTeacher found')
			
			//Go through each class, and each student in the class
			for (var classId in teacher.classes){
				for (var student_index in teacher.classes[classId]){
					
					//Fetch the student from the database
					var student=await client
					.db('schoolsitedb')
					.collection('students')
					.findOne(
						{'studentId':teacher.classes[classId][student_index]}
					);
					
					//If the student exists then temporarily replace the studentId with the student
					if(student!=null){
						console.log('\t\tStudent found')
						teacher.classes[classId][student_index]=student;
					}else{
						console.log('\t\tStudent not found')
						//The student doesn't exist(Database error)
						
						//Set a missing student filler to inform the user of the missing student
						teacher.classes[classId][student_index]={
							studentId: teacher.classes[classId][student_index],
							email: 'Missing',
							name: 'Missing'
						};
						//**todo?(Err) raise error or exception
					}
				}
			}
			
			//Send the teacher class information back to the user
			res.send(JSON.stringify({'classNames':teacher.classNames,'classes':teacher.classes}));
		}else{
			console.log('\tTeacher not found')
			//The teacher does not exist(Cookie error)
			//**Done(Err) raise Error / Exception
			
			res.status(500);
			res.send();
		}
	}finally{
		client.close();
	}	
});
app.post('/report',async function(req,res){
	console.log('/report');
	
	//Check if the year has ended
	if(await getReportingPeriod() == endOfYear){
		console.log('\tYear Has Ended');
		//Inform the user that the year has ended
		res.status(400);
		res.send(JSON.stringify({'code': '401'}));
		return
	}
	
	//Checks if the report is valid using the checkReport function
	var valid=await checkReport(req.session.teacherId,req.body.classId,req.body.studentId);
	if(valid==true){
		console.log('\tReport is valid');
		
		try{
			await client.connect();
			
			var reportGet=await client
			.db('schoolsitedb')
			.collection('reports')
			.findOne(
			{'studentId':req.body.studentId,
			'classId':req.body.classId,
			'teacherId':req.session.teacherId,
			finalized: false});
			
			console.log('\tReport found');
			res.send(JSON.stringify({'data':reportGet.data}));
			
		}finally{
			client.close();
		}
	}else{
		console.log('\tReport is invalid');
		//**Done inform user that the report was invalid
		res.status(valid);
		res.send();
	}
})
app.post('/student',async function(req,res){
	console.log('/student');
	try{
		await client.connect();
		
		let student=await client
		.db('schoolsitedb')
		.collection('students')
		.findOne(
		{'studentId':req.body.studentId});
		
		if(student!=null){
			console.log('\tStudent found')
			res.send(JSON.stringify({'name':student.name,'email':student.email}));
		}else{
			console.log('\tStudent not found')
			//The report for this student does not exist
			//**//Todo either (Create new student, or , send error message)
			//**todo?? send error message
			res.status(400);
			res.send(JSON.stringify({'name':'Null','email':'Null'}));
		}
		
	}finally{
		client.close();
	}
})



//Teacher Add Class/Student
app.post('/newClass',async function(req,res){
	//Possibly check if it updated or not
	
	//Use Atomic Operators to Update only Classes
	
	console.log('/newClass');
	
	try{
		await client.connect();
		
		//Update teacher object in database
		//and recieve if it worked or not
		let updateInfo=await client
		.db('schoolsitedb')
		.collection('teachers')
		.updateOne({$and: [
		{'teacherId': req.session.teacherId},
		{$nor: [
			{['classNames.'+[req.body.classId]]: {$exists: true}},
			{'namesList': {$elemMatch: {$eq: req.body.className}}}
		]}]},
		{$push: {
				namesList: req.body.className
		},
		$set :{
			['classNames.'+[req.body.classId]]: req.body.className,
			['classes.'+[req.body.classId]]: []
		}});
		
		//If it found a match and updated it
		if(updateInfo.matchedCount==1){
			console.log('\tClass added')
			res.send();
		}else{
			//If it could not find/update it
			//**Done check what went wrong and send message to user.
			console.log('\tClass not added. Error occured');
			res.status(400);
			
			//Figure out why it couldn't find teacher
			
			let teacherExists = await client
			.db('schoolsitedb')
			.collection('teachers')
			.count(
			{'teacherId': req.session.teacherId},
			{limit: 1});
			
			if(teacherExists==1){
				//Teacher does exist
				console.log('\tTeacher Exists');
				
				//Check duplicate class Id
				let classIdMatch = await client
				.db('schoolsitedb')
				.collection('teachers')
				.count({$and: [
				{'teacherId': req.session.teacherId},
				{['classNames.'+[req.body.classId]]: {$exists: false}}
				]},
				{limit: 1});
				
				if(classIdMatch==1){
					console.log('\tDuplicate Class Name')
					//No duplicate typed class Id
					
					//Must be Duplicate Class Name
					
					
					res.send(JSON.stringify({'code': 401}))
				}else{
					//Check for duplicate Class Name
					
					let classNameMatch = await client
					.db('schoolsitedb')
					.collection('teachers')
					.count({$and: [
					{'teacherId': req.session.teacherId},
					{'namesList': {$not: {$elemMatch: {$eq: req.body.className}}}}
					]},
					{limit: 1});
					
					if(classNameMatch==1){
						//Duplicate typed class Id
						console.log('\tDuplicate Class Id')
					
						res.status(400);
						res.send(JSON.stringify({'code': 402}))
						
					}else{
						//Duplicate typed class Id and Class Name
						console.log('\tDuplicate Class Name')
						console.log('\tDuplicate Class Id')
					
						res.status(400);
						res.send(JSON.stringify({'code': 403}))
					}
					
					
				}
			}else{
				//Teacher does not exist
				console.log('\tTeacher Does Not Exists')
				res.status(500);
				res.send()
			}
		}
	}finally{
		client.close();	
	}
})
app.post('/addStudent',async function(req,res){
	//Use Atomic Operators to Update only Students
	
	console.log('/addStudent');
	
	try{
		await client.connect();
		
		//Checks to make sure student Exists
		let studentExists=await client.db('schoolsitedb')
		.collection('students')
		.count({'studentId': req.body.studentId},{limit: 1})
		
		if(studentExists==1){
			console.log('\tStudent found')
			console.log('\tAdding student')
			//Update teacher object from database
			
			await client.db('schoolsitedb')
			.collection('teachers')
			.updateOne(
			{$and: [
				{'teacherId': req.session.teacherId},
				{['classes.'+[req.body.classId]]: {$exists: true}},
				{['classes.'+[req.body.classId]]: {$not: {$elemMatch: {$eq: req.body.studentId}}}}
			]},
			{$addToSet: 
				{['classes.'+[req.body.classId]]: req.body.studentId}
			});
			
			res.send();
		}else{
			console.log('\tStudent not found');
			
			//**todo?? Return student doesn't exist error
		}
	}finally{
		client.close();	
	}
})

//Teacher Remove Class/Student
//??(---Allow-undo-or-- __warn__ that "WARNING THIS ACTION CANNOT BE UNDONE")
app.post('/delClass',async function(req,res){
	//**todo? Possibly check if it updated or not
	
	//Use Atomic Operators to Update only Classes
	
	console.log('/delClass');
	
	try{
		await client.connect();
		
		//archive all student reports
		var teacher=await client
		.db('schoolsitedb')
		.collection('teachers')
		.findOne({$and: [
		{'teacherId': req.session.teacherId},
		{['classNames.'+[req.body.classId]]: {$exists: true}},
		{'namesList': {$elemMatch: {$eq: req.body.className}}}
		]});
		
		if(teacher!=null){
			console.log('\tTeacher found')
			for (var studentId of teacher.classes[req.body.classId]){
				//remove report of each student
				console.log('\t\tFinding report')
				
				//**Don't (don't prevent deletion) maybe check if report valid
		
				await client.db('schoolsitedb')
				.collection('reports')
				.updateOne(
				{'teacherId': req.session.teacherId,
				'classId': req.body.classId,
				'studentId': studentId,
				'finalized': false},
				{$set: {'finalized': true}});
				
				console.log('\t\tReport finalized')
			}
			
			//Update teacher object in database
			await client.db('schoolsitedb')
			.collection('teachers')
			.updateOne({$and: [
			{'teacherId': req.session.teacherId},
			{['classNames.'+[req.body.classId]]: {$exists: true}},
			{'namesList': {$elemMatch: {$eq: req.body.className}}}
			]},
			{$pull: {
				namesList: req.body.className
			},
			$unset :{
				['classNames.'+[req.body.classId]]: "",
				['classes.'+[req.body.classId]]: ""
			}});
		
			console.log('\tClass deleted')
			res.send();
			
		}else{
			console.error("Teacher not found");
			//**todo? add error teacher does not exist
		}
		
		
	}finally{
		client.close();	
	}
})
app.post('/resetClass',async function(req,res){
	//**todo? Possibly check if it updated or not
	
	//Use Atomic Operators to Update only Classes
	
	console.log('/resetClass');
	
	try{
		await client.connect();
		
		//archive all student reports
		var teacher=await client
		.db('schoolsitedb')
		.collection('teachers')
		.findOne({$and: [
		{'teacherId': req.session.teacherId},
		{['classNames.'+[req.body.classId]]: {$exists: true}},
		{'namesList': {$elemMatch: {$eq: req.body.className}}}
		]});
		
		if(teacher!=null){
			console.log('\tTeacher found')
			for (var studentId of teacher.classes[req.body.classId]){
				//remove report of each student
				console.log('\t\tFinding report')
				
				//**Don't (don't prevent deletion) maybe check if report valid
		
				await client.db('schoolsitedb')
				.collection('reports')
				.updateOne(
				{'teacherId': req.session.teacherId,
				'classId': req.body.classId,
				'studentId': studentId,
				'finalized': false},
				{$set: {'finalized': true}});
				
				console.log('\t\tReport finalized')
			}
			
			//Update teacher object in database
			await client.db('schoolsitedb')
			.collection('teachers')
			.updateOne({$and: [
			{'teacherId': req.session.teacherId},
			{['classNames.'+[req.body.classId]]: {$exists: true}},
			{'namesList': {$elemMatch: {$eq: req.body.className}}}
			]},
			{$set :{
				['classes.'+[req.body.classId]]: []
			}});
		
			console.log('\tClass reset')
			res.send();
			
		}else{
			console.error("Teacher not found");
			//**todo? add error teacher does not exist
		}
	}finally{
		client.close();	
	}
})
app.post('/delStudent',async function(req,res){
	console.log('/delStudent');
	
	try{
		await client.connect();

		//**Don't maybe check if the report is valid
		console.log('\tFinding report');
		//Update report object in database
		
		await client.db('schoolsitedb')
		.collection('reports')
		.updateOne(
		{'teacherId': req.session.teacherId,
		'classId': req.body.classId,
		'studentId': req.body.studentId,
		'finalized': false},
		{$set: {'finalized': true}});
		
		console.log('\tReport finalized')
		
		console.log('\tUpdating teacher list');
		
		//Update teacher object from database
		await client.db('schoolsitedb')
		.collection('teachers')
		.updateOne(
		{'teacherId': req.session.teacherId},
		{$pull: {['classes.' + [req.body.classId]]: req.body.studentId}});
		
		res.send();
	}finally{
		client.close();	
	}
})

//New report submission
app.post('/updateReport', async function(req,res){
	console.log('/updateReport')
	
	var valid = await checkReport(req.session.teacherId,req.body.classId,req.body.studentId);
	if(valid == true){
		try{
			await client.connect();
		
			console.log('\tUpdating report')
			reportingPeriod=await getReportingPeriod();
			
			await client
			.db('schoolsitedb')
			.collection('reports')
			.updateOne(
			{'teacherId': req.session.teacherId,
			'classId': req.body.classId,
			'studentId': req.body.studentId,
			'finalized': false},
			{$set: {['data.'+(reportingPeriod-1)]: req.body.data}}
			);
			
			console.log('\tReport updated');
			res.send();
			
		}finally{
			client.close();
		}
	}else{
		res.status(400);
		//**todo raise error report invalid
	}
})

//Verify report validity
async function checkReport(teacherId,classId,studentId){
	//Checks the validity of the report and if it is invalid returns an http error code with message
	console.log('Checking Report')
	
	try{
		await client.connect();
		
		console.log('Connected');
		
		//(resolved)Error Here. caused due to trying to acces the req.body while in this function there is no req	
		var report=await client
		.db('schoolsitedb')
		.collection('reports')
		.findOne({
		'teacherId': teacherId,
		'classId': classId,
		'studentId': studentId,
		'finalized': false
		});
		
		console.log('\tReport Fetched')
		
		let year=await getYear();
		let reportingPeriod=await getReportingPeriod();
		
		console.log('\tChecking Case')
		if(report==null){
			//The report was not found or does not exist
			console.log('\t\tNull Report(Creating new report)');
			
			let year=await getYear();
			report={
				'classId':classId,
				'studentId':studentId,
				'data': Array(reportingPeriod).fill({
					"percentageMark": "",
					"responsibility": "",
					"organzation": "",
					"independantWork": "",
					"collaboration": "",
					"initiative": "",
					"selfRegulation": "",
					"comment": ""}),
				'finalized': false,
				'teacherId': teacherId,
				'year': year
			}
			
			var result=await client
			.db('schoolsitedb')
			.collection('reports')
			.updateOne(
			{'classId':report['classId'],
			'studentId':report['studentId'],
			'teacherId':report['teacherId'],
			'finalized': false},
			{$setOnInsert:report},{upsert:true});
				
			if(result.matchedCount==0){
				console.log('\tNew report created');
				client.close();
				return true;
			}else{
				console.log('\tNew report already exists');
				//Should not happen as it checks that the report doesn't exist
				client.close();
				return (500);
			}
		}else if(report.year!=year){
			//The report was not finalized properly in the previous year
			console.log('\t\tWrong Year');
			
			await client.db('schoolsitedb')
			.collection('reports')
			.updateOne(
			{'teacherId': teacherId,
			'classId': classId,
			'studentId': studentId,
			'finalized': false},
			{$set: {'finalized': true}});
			
			console.log('\tReport Finalized')
			
			client.close();
			return 500;
			
		}else if(report.data.length<reportingPeriod){
			//The reporting period has expired
			console.log('\t\tReporting Period Has Expired');
			if(reportingPeriod != endOfYear){
				//A new term should be added
				console.log('\t\tNeeds new Reporting Period');
				
				let data=Array(reportingPeriod-report.data.length).fill({
				"percentageMark": "",
				"responsibility": "",
				"organzation": "",
				"independantWork": "",
				"collaboration": "",
				"initiative": "",
				"selfRegulation": "",
				"comment": ""});
				
				await client.db('schoolsitedb')
				.collection('reports')
				.updateOne(
				{'teacherId': teacherId,
				'classId': classId,
				'studentId': studentId,
				'finalized': false},
				{$push: {'data': {$each: data}}});
				
				console.log('\tNew Reports Filled')
				
				client.close();
				return 500;
			}else{
				//The end of year has been reached. Report should be finalized
				await client.db('schoolsitedb')
				.collection('reports')
				.updateOne(
				{'teacherId': teacherId,
				'classId': classId,
				'studentId': studentId,
				'finalized': false},
				{$set: {'finalized': true}});
				
				console.log('\tReport Finalized')
				
				client.close();
				return true;
			}
		}else if(report.data.length>reportingPeriod){
			//The report has an extra report(This should never happen (Time travel))
			console.log('\t\tExtra Reporting Period');
			
			//**Don't fix maybe
			
			client.close();
			return 500;
			
		}else{
			//The report is valid
			console.log('\t\tValid Report');
			
			client.close();
			return true;
		}
	}finally{
		client.close();
	}
	return 500;
}

//Debuging add data directly to server
async function setupData(){
	try{

		await client.connect();
		
		var student1={
			"studentId": "S332864735",
			"email": "acorm1@ocdsb.ca",
			"name": "Avery Cormier"
		};
		var student2={
			"studentId": "S123456789",
			"email": "name@domain.com",
			"name": "User Name"
		};
		var student3={
			"studentId": "S111111111",
			"email": "UName2@ocdsb.ca",
			"name": "User2Name"
		};
		
		await client.db('schoolsitedb').collection('students').updateOne(
			{'studentId':student1.studentId},{$setOnInsert:student1},{upsert:true});
		await client.db('schoolsitedb').collection('students').updateOne(
			{'studentId':student2.studentId},{$setOnInsert:student2},{upsert:true});
		await client.db('schoolsitedb').collection('students').updateOne(
			{'studentId':student3.studentId},{$setOnInsert:student3},{upsert:true});
		
	} finally {
	client.close();
}}

//setupData();

//todo? add grade for student data class(elemetary/middle/high school)

//Start Listening on a port
app.listen(Port);
console.log(`New server Listening on Port ${Port}`);
async function print(){
	let schoolYear=await getYear();
	let termPeriod=await getReportingPeriod();
	let day=Date();
	console.log(`Server started in the ${schoolYear} school year in term #${termPeriod}.`);
	console.log(`The day is ${day}.`)
}

print();