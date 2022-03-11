const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const healthBar = document.getElementById("health-bar");

canvas.height = window.innerHeight;
canvas.width = canvas.height;

class Circle {

    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI, false);
        ctx.fill();
    }
}

class Ball extends Circle {

    constructor(x, y, velX, velY, radius) {
        super(x, y, radius);
        this.velX = velX;
        this.velY = velY;
        this.theta = null;
        this.thetaDot = null;
        this.thetaDoubleDot = null;

        this.g = 0.5;
        this.health = 100;
        this.forceOut = false;
        this.trail = [];
    }

    update(circle) {
        // gravity is tripled when the mouse is being pressed
        if (mouseDown) {
            this.g = 1.5;
        } else {
            this.g = 0.5;
        }
        const realRadius = (circle.radius - this.radius);

        // Checks if the ball is colliding with the boundaries of its inclosing circle
        // if not, the motion is treated as free fall
        // if yes, the motion is treated as if it was a pendulum

        if (!this.isColliding(circle) || this.forceOut) {

            // Theta is set to null so that once the ball hits the walls, we know that it was previously in free fall
            this.theta = null;

            this.velY += this.g;
            this.y += this.velY;
            this.x += this.velX;

            // The forceOut boolean is just a workaround so that the ball has another frame to leave the walls of the circle
            // because sometimes just a single iteration isn't enough to get it out of the boundaries and into free fall
            // could be removed for a better alternative

            this.forceOut = false;

        } else {

            if (this.theta == null) {

                // This code is run when the ball just hit the walls.
                this.theta = this.getTheta(circle);

                /* Here, the angular speed is set such that only the component of the original velocity
                   that is tangent to the circle at the point of collision goes into the the calculations
                   and the component perpendicular to it is lost */
                this.thetaDot = (this.velX * Math.cos(this.theta) - this.velY * Math.sin(this.theta)) / realRadius;

                this.thetaDoubleDot = (-this.g / realRadius) * Math.sin(this.theta);
            }
            this.updateTheta(circle);
            this.x = realRadius*Math.sin(this.theta) + circle.x;
            this.y = realRadius*Math.cos(this.theta) + circle.y;

            if (this.thetaDot*this.thetaDot*realRadius <= -this.g*Math.cos(this.theta)) {
                this.velX = this.thetaDot*realRadius*Math.cos(this.theta);
                this.velY = -this.thetaDot*realRadius*Math.sin(this.theta);
                this.forceOut = true;
            }
        }
    }

    // Checks if the ball is hitting the boundaries of its surrounding circle
    // This technically is checking if the ball is outside the circle
    isColliding(circle) {
        const xRel = this.x - circle.x;
        const yRel = this.y - circle.y;
        const radius = (circle.radius - this.radius);

        /* The - 0.000000001 is a workaround because this check doesn't work perfectly when the ball
           is exactly on the boundaries */
        return (xRel*xRel + yRel*yRel >= radius*radius - 0.000000001);
    }

    updateTheta(circle) {
        // Sets the angular acceleration based on an accurate DE describing pendulums
        const radius = (circle.radius - this.radius);
        this.thetaDoubleDot = (-this.g / radius) * Math.sin(this.theta);

        // Updates the angular speed based on the angular acceleration
        this.thetaDot += this.thetaDoubleDot;

        // Updates theta based on the angular speed
        this.theta += this.thetaDot;
    }

    getTheta(circle) {
        const xRel = this.x - circle.x;
        const yRel = this.y - circle.y;

		let theta = -Math.atan(yRel / xRel) + Math.PI / 2;
		if (xRel < 0) {
			return theta - Math.PI;
		}
		return theta;
    }

    updateTrail() {
        if (this.trail.length >= 15) {
            this.trail.shift();
        }
        this.trail.push(new Circle(this.x, this.y, this.radius));
    }

    drawTrail() {
        for (let i = 0; i < this.trail.length; i++) {
            this.trail[i].radius *= (Math.sqrt(i) + 10)/(Math.sqrt(this.trail.length) + 10);

            ctx.fillStyle = `rgba(${32}, ${50}, ${57}, ${(i*i)/(this.trail.length*this.trail.length)/3})`;
            this.trail[i].draw();
        }
    }
}

class Particle extends Circle {

    constructor(x, y, radius) {
        super(x, y, radius);

        this.splashObj = new Splash(0, 0, 0);
        this.spawnTime = Date.now();
    }

    // Checks if the ball is colliding with the food particle
    isColliding(ball) {
        const deltaX = ball.x - this.x;
        const deltaY = ball.y - this.y;
        const radiusSum = ball.radius + this.radius;

        return (deltaX * deltaX + deltaY * deltaY <= radiusSum * radiusSum);
    }

    // Sets the food particle to a random position inside the inclosing circle
    setToRandomPosition(circle) {

        const realRadius = circle.radius - this.radius;

        while (true) {
            const randomX = Math.random() * 2 - 1;
            const randomY = Math.random() * 2 - 1;
            if (randomY*randomY + randomX*randomX <= 1) {
                this.x = realRadius * randomX + circle.x;
                this.y = realRadius * randomY + circle.y;
                return;
            }
        }
    }
}

class Food extends Particle {

    static color = "#D82148";
    static score = 0;
    static splashObjects = [];

    constructor(x, y, radius) {
        super(x, y, radius);
    }

    update(circle, ball) {
        
        if (this.isColliding(ball)) {
            const newSplash = new Splash(this.x, this.y, this.radius);
            newSplash.color = Food.color;
            Splash.splashObjects.push(newSplash);

            Food.score++;
            if (ball.health < 90) {
                ball.health += 10;
            }
            if (ball.health < 100 && ball.health > 90) {
                ball.health = 100;
            }
            this.setToRandomPosition(circle);
        }
        
    }
}

class Obstacle extends Particle {

    // default color
    static color = "black";

    constructor(x, y, radius) {
        super(x, y, radius);
    }

    update(circle, ball) {

        if (this.isColliding(ball)) {
            const newSplash = new Splash(this.x, this.y, this.radius);
            newSplash.color = Obstacle.color;
            Splash.splashObjects.push(newSplash);
            ball.health -= 10;
            this.setToRandomPosition(circle);
        }
    }
}

class Splash {

    static splashObjects = [];

    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.splashing = false;
        this.spawnTime = Date.now();

        // default color;
        this.color = "black";
        this.splashParticles = [];

        // initializing the array of splash particles
        for (let i = 0; i < 20; i++) {
            const splashParticle = new Circle(this.x, this.y, Math.random()*this.radius);
            const theta = Math.random() * 2 * Math.PI;
            const speed = Math.random();
            splashParticle.velX = speed * Math.cos(theta);
            splashParticle.velY = speed * Math.sin(theta);
            this.splashParticles.push(splashParticle);
        }
    }

    update() {
        for (const splashParticle of this.splashParticles) {
            splashParticle.x -= splashParticle.velX;
            splashParticle.y += splashParticle.velY;
            splashParticle.radius *= 19/20;
        }
        /* This is equivalent to removing the splash animation after 3 seconds */
        if (Date.now() - this.spawnTime >= 3000) {
            let index = Splash.splashObjects.indexOf(this);
            if (index == -1) {
                index = Splash.splashObjects.indexOf(this);
            }
            if (index > -1) {
                Splash.splashObjects.splice(index, 1);
            }
        }
    }
    draw() {
        for (const splashParticle of this.splashParticles) {
            splashParticle.draw();
        }
    }
}

// initializing the main ball and the inclosing circle
const ball = new Ball(200, 300, 0, 0, 15);
const bound = new Circle(canvas.width/2, canvas.height/2, canvas.height/2 - 10);

// code to handle mouse input
let mouseDown = 0;
document.body.onmousedown = function() { 
    mouseDown = 1;
}
document.body.onmouseup = function() {
    mouseDown = 0;
}

const maxFoods = 5;
const maxObstacles = 3;
const food = [];
const obstacles = [];

for (let i = 0; i < maxFoods; i++) {
    const foodParticle = new Food(0, 0, 8);
    foodParticle.setToRandomPosition(bound);
    food.push(foodParticle);
}

for (let i = 0; i < maxObstacles; i++) {
    const obstacle = new Obstacle(0, 0, 8);
    obstacle.setToRandomPosition(bound);
    obstacles.push(obstacle);
}

let spawnTimer = Date.now(); 

// Handles all updating
function update() {
    
    ball.update(bound);
    ball.updateTrail();
    
    for (let splash of Splash.splashObjects) {
        splash.update();
    }

    for (let foodParticle of food) {
        foodParticle.update(bound, ball);
    }

    for (let obstacle of obstacles) {
        obstacle.update(bound, ball);
    }

}

// Handles all drawing
function draw() {
    ctx.fillStyle = "#54777D";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#EEEDDE";
    bound.draw();

    ball.drawTrail();

    ctx.fillStyle = "#203239";
    ball.draw();

    ctx.fillStyle = Food.color;
    for (let foodParticle of food) {
        foodParticle.draw();
    }

    ctx.fillStyle = Obstacle.color;
    for (let obstacle of obstacles) {
        obstacle.draw();
    }

    for (let splash of Splash.splashObjects) {
        ctx.fillStyle = splash.color;
        splash.draw();
    }
}

function animate() {
    requestAnimationFrame(animate);

    update();
    draw();

    scoreElement.textContent = `Score: ${Food.score}`;

    // loses 3% health per second assuming frame rate is 60fps
    ball.health -= 1 / 20;

    healthBar.style.width = `${ball.health}%`;
    if (ball.health <= 0) {
        if(!alert("GAME OVER!")){
            ball.health = 100;
            window.location.reload();
        }
    }
    
}

animate();
