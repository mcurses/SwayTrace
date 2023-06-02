import p5 from "p5";
import {Dimensions, Coordinates, constrain} from "../../utils/Utils"
import Vector from "../../utils/Vector";
import {HSLColor} from "../../utils/HSLColor";
import Score from "../Score/Score";
import {vectBodyToWorld, vectWorldToBody} from "./CarUtils";
import {driftColor} from "../Score/ScoreVisualize";


class Car {
    turnRateStatic: number;
    turnRateDynamic: number;
    turnRate: number;
    gripStatic: number;
    gripDynamic: number;
    DRIFT_CONSTANT: number;
    pos: Vector;
    velocity: Vector;
    acceleration: Vector;
    angle: number;
    mass: number;
    width: number;
    length: number;
    force: number;
    isDrifting: boolean;
    color: HSLColor;
    id: string;
    trail: any[];
    trailCounter: number;
    targetPosition: Vector | null;
    targetAngle: number | null;
    lastDriftTime: number;
    idleTime: number;
    isColliding: boolean;


    constructor(posX = window.innerWidth / 2, posY = window.innerHeight / 2, angle = 0) {
        let turnFactor = 0.5;
        this.turnRateStatic = 0.008 * turnFactor
        this.turnRateDynamic = 0.003 * turnFactor
        this.turnRate = this.turnRateStatic;
        this.gripStatic = .2;
        this.gripDynamic = .1;
        this.DRIFT_CONSTANT = 1.7;
        this.pos = new Vector(posX, posY);
        this.velocity = new Vector(0, 0);
        this.acceleration = new Vector(0, 0);
        this.angle = angle;
        this.mass = 22;
        this.width = 18;
        this.length = 30;
        this.force = 0.005;
        this.isDrifting = false;
        this.color = new HSLColor(0, 100, 50);
        this.id = "";
        this.trail = [];
        this.trailCounter = 0;
        this.targetPosition = null;
        this.targetAngle = null;
        this.lastDriftTime = 0;
        this.idleTime = 0;
    }

    /*******************************************************************************
     *  Safely read car variables
     ******************************************************************************/
    getPos(): Coordinates {
        return {x: this.pos.x, y: this.pos.y}
    }

    isDrift(): boolean {
        return this.isDrifting;
    }

    getAngle(): number {
        return this.angle;
    }

    setAngle(angle: number) {
        this.angle = angle;
    }

    setTrail(trail: any[]) {
        this.trail = trail;
    }

    getTrail() {
        return this.trail;
    }

    setPosition(position: Vector) {
        this.pos = position;
    }

    setDrift(drifting: boolean) {
        this.isDrifting = drifting;
    }


    update(keys, deltaTime) {
        // Add input forces
        if (keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight']) {
            // ACCELERATING (BODY-FIXED to WORLD)
            if (keys['ArrowUp']) {
                let bodyAcc = new Vector(0, this.force);
                let worldAcc = vectBodyToWorld(bodyAcc, this.angle);
                this.acceleration.add(worldAcc);
            }
            // BRAKING (BODY-FIXED TO WORLD)
            if (keys['ArrowDown']) {
                let bodyAcc = new Vector(0, -this.force);
                let worldAcc = vectBodyToWorld(bodyAcc, this.angle);
                this.acceleration.add(worldAcc);
            }
            if (keys['ArrowLeft']) {
                this.angle -= this.turnRate * deltaTime;
            }
            if (keys['ArrowRight']) {
                this.angle += this.turnRate * deltaTime;
            }
        }


        // Car steering and drifting physics

        // Rotate the global velocity vector into a body-fixed one. x = sideways
        // velocity, y = forward/backwards
        let vB = vectWorldToBody(this.velocity, this.angle);

        let bodyFixedDrag;
        let grip;
        if (Math.abs(vB.x) < this.DRIFT_CONSTANT) {
            // Gripping
            grip = this.gripStatic
            this.turnRate = this.turnRateStatic;
            this.isDrifting = false;
        } else {
            // Drifting
            grip = this.gripDynamic;
            this.turnRate = this.turnRateDynamic;
            this.isDrifting = true;
        }
        bodyFixedDrag = new Vector(vB.x * -grip, vB.y * 0.05);

        // Rotate body fixed forces into world fixed and add to acceleration
        let worldFixedDrag =
            vectBodyToWorld(bodyFixedDrag, this.angle)
        this.acceleration.add(
            worldFixedDrag.div(this.mass)); // Include inertia


        // Physics Engine
        this.angle = this.angle % (2 * Math.PI); // Restrict angle to one revolution
        this.velocity.add(this.acceleration);
        this.pos.add(this.velocity.mult(deltaTime));
        this.acceleration = new Vector(0, 0); // Reset acceleration for next frame



    }

    interpolatePosition() {
        if (this.targetPosition) {
            let distance = Vector.dist(this.pos, this.targetPosition);
            // if difference is too large, just teleport
            if (distance > 500) {
                this.pos = new Vector(this.targetPosition.x, this.targetPosition.y);
                this.targetPosition = null;
            } else {
                let targetPos = new Vector(this.targetPosition.x, this.targetPosition.y);
                this.pos = Vector.lerp(this.pos, targetPos, 0.1);
            }
            if (distance < 1) {
                this.targetPosition = null;
            }
        }
        if (this.targetAngle !== null) {
            let difference = this.targetAngle - this.angle;
            while (difference < -Math.PI) difference += Math.PI * 2;
            while (difference > Math.PI) difference -= Math.PI * 2;

            if (Math.abs(difference) > Math.PI / 2) {
                this.angle = this.targetAngle;
                this.targetAngle = null;
            } else {
                let turnDirection = difference > 0 ? 1 : -1;
                this.angle += this.turnRate * turnDirection;
                if (Math.abs(this.targetAngle - this.angle) < this.turnRate) {
                    this.angle = this.targetAngle;
                    this.targetAngle = null;
                }
            }
        }
    }


    render(ctx) {

        let curCar = this
        let id = curCar.id;

        curCar.interpolatePosition();

        // Set color
        if (!curCar.isDrift()) {
            curCar.color = new HSLColor(0, 0, 100);
        }
        if (curCar.isColliding) {
            curCar.color = new HSLColor(255, 255, 255);
        }

        // Save the current context
        ctx.save();

        // Translate and rotate the context
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);

        // Set stroke and fill styles
        ctx.lineWidth = this.isDrifting ? 3 : 2;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#000';  // Assuming the stroke color to be black

        // Draw the car body and front side indicator
        ctx.fillRect(-this.width / 2, -this.length / 2, this.width, this.length);
        ctx.strokeRect(-this.width / 2, -this.length / 2, this.width, this.length);

        ctx.fillRect(-this.width / 2 + 1, 0, this.width - 2, 6);
        ctx.strokeRect(-this.width / 2 + 1, 0, this.width - 2, 6);

        // Restore the context to its original state
        ctx.restore();

    }

    getCorners() {

        let width = this.width;
        let height = this.length;
        let corners = [];

        // Calculate the corners relative to the car's center point
        let frontLeft = new Vector(width / 2, height / 2);
        let frontRight = new Vector(width / 2, height / 2);
        let backLeft = new Vector(width / 2, height / 2);
        let backRight = new Vector(width / 2, height / 2);

        corners.push(frontLeft);
        corners.push(frontRight);
        corners.push(backLeft);
        corners.push(backRight);

        let rotatedCorners = [];
        for (let i = 0; i < corners.length; i++) {
            let corner = corners[i];
            let rotatedCorner = Vector.rotatePoint(corner, new Vector(0, 0), this.angle);
            rotatedCorners.push(rotatedCorner);
        }
        return rotatedCorners;
    }
}

export default Car;