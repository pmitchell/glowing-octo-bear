private var motor : ShipMotor;

// 360 degrees per unit time
var MAX_ROTATION_SPEED : float = 360;
var inspectorSeesThis : boolean = true;


// Use this for initialization
function Awake () {
	motor = GetComponent(ShipMotor);
	Debug.Log("Awake!" + Time.timeSinceLevelLoad);
}

function Start () {
	Debug.Log("Start!" + Time.timeSinceLevelLoad);
}

function Update () {

	// Get the input vector from keyboard or analog stick
	var directionVector = new Vector3(Input.GetAxis("Horizontal"), Input.GetAxis("Vertical"), 0);

	// Normalize and rotate in line with camera.
	directionVector = Vector3.Normalize(directionVector);
	directionVector = Camera.main.transform.TransformDirection(directionVector);
	
	// Apply the direction to the motor
	motor.inputMoveDirection = directionVector;
	motor.inputJump = Input.GetButton("Jump");	
	
	// Spaceflight: constantly grounded, jumping accelerates forward
	motor.grounded = true;
	motor.jumping.jumpDir = Camera.main.transform.forward;
	
	if (motor.inputJump) {
		Debug.Log("Jump!!!" + motor.jumping.jumpDir);
	}

	// Rotate towards the move direction
	// transform from ???	
	var newForward : Vector3 = Vector3.Slerp( 
			transform.forward,
			directionVector,
			MAX_ROTATION_SPEED * Time.deltaTime
		);

	transform.rotation = Quaternion.LookRotation(newForward, transform.forward);
}


// Require a character controller to be attached to the same game object
@script RequireComponent (ShipMotor)
@script AddComponentMenu ("Character/Spaceship Input Controller")