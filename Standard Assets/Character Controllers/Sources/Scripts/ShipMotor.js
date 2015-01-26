#pragma strict
#pragma implicit
#pragma downcast

// Does this script currently respond to input?
var canControl : boolean = true;

var useFixedUpdate : boolean = true;

// For the next variables, @System.NonSerialized tells Unity to not serialize the variable or show it in the inspector view.
// Very handy for organization!

// The current global direction we want the character to move in.
@System.NonSerialized
var inputMoveDirection : Vector3 = Vector3.zero;

// Is the accelerate button held down? We use this interface instead of checking
// for the accelerate button directly so this script can also be used by AIs.
@System.NonSerialized
var inputAccelerate : boolean = false;

private var tr : Transform;
private var controller : CharacterController;

class ShipMotorMovementController {
	// The maximum acceleration when moving
	var maxForwardThrust : float = 5;
	var maxBackwardsThrust : float = 5;

	var maxRollThrust : float = 1.0;
	var maxPitchThrust : float = 1.0;
	var maxYawThrust : float = 60.0;
	
	// For the next variables, @System.NonSerialized tells Unity to not serialize the variable or show it in the inspector view.
	// Very handy for organization!

	// The last collision flags returned from controller.Move
	@System.NonSerialized
	var collisionFlags : CollisionFlags; 

	// We will keep track of the character's current velocity,
	// and use acceleration to change this
	//@System.NonSerialized
	var velocity : Vector3;

	// We will keep track of the character's current rotational inertia,
	// and use acceleration to change this
	//@System.NonSerialized
	var angularVelocity : Vector3;
	
	@System.NonSerialized
	var hitPoint : Vector3 = Vector3.zero;
	
	@System.NonSerialized
	var lastHitPoint : Vector3 = Vector3(Mathf.Infinity, 0, 0);
}

var movement : ShipMotorMovementController = ShipMotorMovementController();

// We will contain all the accelerating related variables in one helper class for clarity.
class ShipMotorAccelController {
	// Can the character go?
	var enabled : boolean = true;

	// How high do we accelerate when pressing accelerate and letting go immediately
	var baseThrust : float = 0.3;
	
	// We add extraHeight units (meters) on top when holding the button down longer while Accelerating
	var extraThrust : float = 4.1;
	
	// For the next variables, @System.NonSerialized tells Unity to not serialize the variable or show it in the inspector view.
	// Very handy for organization!

	// Are we Accelerating? (Initiated with accelerate button and not grounded yet)
	// To see if we are just in the air (initiated by Accelerating OR falling) see the grounded variable.
	@System.NonSerialized
	var accelerating : boolean = false;
	
	@System.NonSerialized
	var holdingJumpButton : boolean = false;

	// the time we accelerated at (Used to determine for how long to apply extra accelerate power after accelerating.)
	@System.NonSerialized
	var lastStartTime : float = 0.0;
	
	@System.NonSerialized
	var lastButtonDownTime : float = -100;
}

var accelerator : ShipMotorAccelController = ShipMotorAccelController();


function Awake () {
	controller = GetComponent (CharacterController);
	tr = transform;
}

private function UpdateFunction () {
	// We copy the actual velocity into a temporary variable that we can manipulate.
	var velocity : Vector3 = movement.velocity;
	var rotation : Vector3 = movement.angularVelocity;
	
	// Save lastPosition for velocity calculation.
	var lastPosition : Vector3 = tr.position;

	/////////////////////
	// ANGULAR MOMENTUM
	/////////////////////
	//
	// Update facing based on input
	rotation = ApplyInputRotationChange(rotation);
	
	// We always want the movement to be framerate independent.  Multiplying by Time.deltaTime does this.
	var currentRotationOffset : Vector3 = rotation * Time.deltaTime;
	
	// Apply JUMP-brakes
	// TODO: better
	if (Input.GetButton("Jump"))
		movement.angularVelocity = Vector3.Slerp(
			movement.angularVelocity,
			Vector3.zero,
			accelerator.extraThrust * Time.deltaTime
			);

	tr.Rotate(currentRotationOffset);

	/////////////////////
	// VELOCITY
	/////////////////////
	// Update velocity based on input
	velocity = ApplyInputVelocityChange(velocity);

	// We always want the movement to be framerate independent.  Multiplying by Time.deltaTime does this.
	var currentVelocityOffset : Vector3 = velocity * Time.deltaTime;
	
   	// Move our character!
	movement.collisionFlags = controller.Move (currentVelocityOffset);
	
	// Calculate the velocity based on the current and previous position.  
	// This means our velocity will only be the amount the character actually moved as a result of collisions.
	movement.velocity = (tr.position - lastPosition) / Time.deltaTime;
}

function FixedUpdate () {
	if (useFixedUpdate)
		UpdateFunction();
}

function Update () {
	if (!useFixedUpdate)
		UpdateFunction();
}

private function ApplyInputVelocityChange (velocity : Vector3) {
	if (!canControl)
		return velocity;
			
	// Find desired velocity
	// We're 2D here.
	// Backward thrust not used yet.
	var desiredThrust : float = Input.GetAxis("Vertical") * movement.maxForwardThrust;

	//2D: Restrict z velocity.
	//var ALLOWED_VELOCITY = Camera.main.transform.forward;
	//var ALLOWED_VELOCITY = new Vector3(1, 1, 1);
	//var transformVelocityProjection = Vector3.Project(transform.forward, ALLOWED_VELOCITY);

	var desiredAcceleration : Vector3 = transform.forward * desiredThrust * Time.deltaTime;
	
	// Boosted deceleration if rotation and acceleration are opposed (opposite signs)
	// Dot product: Two vectors in the 
	if (Vector3.Dot(desiredAcceleration, movement.velocity) < 0) 
		desiredAcceleration *= 10;
		
	velocity += desiredAcceleration;
	movement.velocity = velocity;
	
	// Enforce max velocity
	//var velocityChangeVector : Vector3 = (desiredVelocity - velocity);
	//if (velocityChangeVector.sqrMagnitude > maxVelocityChange * maxVelocityChange) {
	//	velocityChangeVector = velocityChangeVector.normalized * maxVelocityChange;
	//}
	
	// Apply JUMP-brakes
	if (Input.GetButton("Jump"))
		movement.velocity = Vector3.Slerp(
			movement.velocity,
			Vector3.zero,
			accelerator.extraThrust * Time.deltaTime
			);
	
	return movement.velocity;
}

private function ApplyInputRotationChange (rotation : Vector3) {
	if (!canControl)
		return rotation;
		
	// Find desired rotation
	// (Invert x axis)
	var desiredYawAcceleration : float = Input.GetAxis("Horizontal") * -movement.maxYawThrust * Time.deltaTime;
	var desiredRotationAxis : float = rotation.y;
	
	// Boosted deceleration if rotation and acceleration are opposed (opposite signs)
	if (desiredRotationAxis * desiredYawAcceleration < 0) 
		desiredYawAcceleration *= 10;
		
	// Accelerate turnwise
	desiredRotationAxis += desiredYawAcceleration;
	
	movement.angularVelocity.y = desiredRotationAxis;

	// Enforce max rotation
	//var velocityChangeVector : Vector3 = (desiredVelocity - velocity);
	//if (velocityChangeVector.sqrMagnitude > maxVelocityChange * maxVelocityChange) {
	//	velocityChangeVector = velocityChangeVector.normalized * maxVelocityChange;
	//}
	
	// Apply JUMP-brakes
	if (Input.GetButton("Jump"))
		movement.angularVelocity = Vector3.Slerp(
			movement.angularVelocity,
			Vector3.zero,
			accelerator.extraThrust * Time.deltaTime
			);
	
	return movement.angularVelocity;
}

function OnControllerColliderHit (hit : ControllerColliderHit) {
//	if (hit.normal.y > 0 && hit.normal.y > groundNormal.y && hit.moveDirection.y < 0) {
//		if ((hit.point - movement.lastHitPoint).sqrMagnitude > 0.001 || lastGroundNormal == Vector3.zero)
//			groundNormal = hit.normal;
//		else
//			groundNormal = lastGroundNormal;
//		
//		movingPlatform.hitPlatform = hit.collider.transform;
//		movement.hitPoint = hit.point;
//		movement.frameVelocity = Vector3.zero;
//	}
	Debug.Log("Ouch!");
}

function GetDirection () {
	return inputMoveDirection;
}

function SetControllable (controllable : boolean) {
	canControl = controllable;
}

// Require a character controller to be attached to the same game object
@script RequireComponent (CharacterController)
@script AddComponentMenu ("Character/Ship Motor")
