// gamescreen.js
// Copyright (c) 2014 AKIYAMA Kouhei
// This software is released under the MIT License.

(function(global){
    if(!global.misohena){global.misohena = {};}
    if(!global.misohena.js_skigame){global.misohena.js_skigame = {};}
    var mypkg = global.misohena.js_skigame;

    mypkg.create = create;
    function create()
    {
        var SCREEN_W = 640;
        var SCREEN_H = 480;

        //
        // Game Screen
        //

        var gameScreen = new misohena.GameScreen(SCREEN_W, SCREEN_H);
        function blockEventPropagation(ev)
        {
            ev.stopPropagation();
        }
        gameScreen.getControlBar().getElement().addEventListener("click", blockEventPropagation, false);
        var menuPauseButton = gameScreen.getControlBar().addButton("left").setText("Pause");
        var menuGiveUpButton = gameScreen.getControlBar().addButton("left").setText("GiveUp");

        //
        // Canvas
        //

        var canvas = document.createElement("canvas");
        canvas.setAttribute("width", SCREEN_W);
        canvas.setAttribute("height", SCREEN_H);
        gameScreen.getElementContentArea().appendChild(canvas);


        //
        // Input Device
        //

        function InputDeviceKeyboard()
        {
            gameScreen.getElement().setAttribute("tabindex", 0);
            gameScreen.getElement().style.outline = "0";
            gameScreen.getElement().style.border = "0";

            var keyLeft = false;
            var keyRight = false;

            function onKeyDown(e){
                switch(e.keyCode){
                case 37: keyLeft = true; return true;
                case 39: keyRight = true; return true;
                }
                return false;
            }
            function onKeyUp(e){
                switch(e.keyCode){
                case 37: keyLeft = false; return true;
                case 39: keyRight = false; return true;
                }
                return false;
            }
            gameScreen.getElement().addEventListener("keydown", function(e){
                if(onKeyDown(e)){
                    e.stopPropagation();
                    e.preventDefault();
                }
            }, false);
            gameScreen.getElement().addEventListener("keyup", function(e){
                if(onKeyUp(e)){
                    e.stopPropagation();
                    e.preventDefault();
                }
            }, false);

            var angle = 0;

            this.getKeyAngle = function(){
                var drag = Math.min(Math.abs(angle), 0.02);
                angle += angle > 0 ? -drag : angle < 0 ? drag : 0;
                angle += (keyLeft ? angle < 0 ? -0.15 : -0.25 : 0) + (keyRight ? angle > 0 ? 0.15 : 0.25 : 0);
                if(angle < -5){
                    angle = -5;
                }
                if(angle > 5){
                    angle = 5;
                }
                return angle;
            };
            this.reset = function(){
                keyLeft = false;
                keyRight = false;
                angle = 0;
            };
        }
        function getScreenOrientationAngle()
        {
            return (screen && screen.orientation && screen.orientation.angle) || window.orientation || 0;
        }
        function InputDeviceOrientation()
        {
            var keyAngle = 0;

            function toRad(deg){return deg*(Math.PI/180);}
            function toDeg(rad){return rad*(180/Math.PI);}

            function getLeftTiltAngleFromOrientationEvent(orientationEvent){
                // r = rotz(alpha)*rotx(beta)*roty(gamma)*rotz(-getScreenOrientationAngle())*colvec[1,0,0]
                // tilt = sin^-1(r.z)
                var b = toRad(orientationEvent.beta || 0);
                var c = toRad(orientationEvent.gamma || 0);
                var d = toRad(-getScreenOrientationAngle());
                var rz = Math.sin(b)*Math.sin(d)-Math.cos(b)*Math.sin(c)*Math.cos(d);
                return toDeg(Math.asin(rz));
            }
            function getLeftTiltAngleFromMotionEvent(motionEvent){
                if(typeof(motionEvent.acceleration.x) != "number" ||
                   typeof(motionEvent.acceleration.y) != "number" ||
                   typeof(motionEvent.acceleration.z) != "number"){
                    return 0;
                }
                var gravityX = (motionEvent.acceleration.x) - (motionEvent.accelerationIncludingGravity.x);
                var gravityY = (motionEvent.acceleration.y) - (motionEvent.accelerationIncludingGravity.y);
                var gravityZ = (motionEvent.acceleration.z) - (motionEvent.accelerationIncludingGravity.z);
                var screenAngleRev = toRad(-getScreenOrientationAngle());
                var rightX = Math.cos(screenAngleRev);
                var rightY = Math.sin(screenAngleRev);
                var dotGR = rightX * gravityX  + rightY * gravityY;
                var rightGravity = dotGR / Math.sqrt(gravityX*gravityX+gravityY*gravityY+gravityZ*gravityZ);
                return -(90 - toDeg(Math.acos(rightGravity)));
            }

            var getLeftTilt;
            if(true){
                getLeftTilt = getLeftTiltAngleFromMotionEvent;
                window.addEventListener("devicemotion", updateAngle, false);
            }
            else{
                getLeftTilt = getLeftTiltAngleFromOrientationEvent;
                window.addEventListener("deviceorientation", updateAngle, false);
            }

            function updateAngle(ev)
            {
                keyAngle = -getLeftTilt(ev);
            }

            this.getKeyAngle = function(){ return keyAngle;};
            this.reset = function(){};
        }
        function InputDevice()
        {
            var key = new InputDeviceKeyboard();
            var ori = (window.DeviceOrientationEvent && typeof(getScreenOrientationAngle()) == "number") ? new InputDeviceOrientation() : null;
            this.getKeyAngle = function(){
                return key.getKeyAngle() + (ori ? ori.getKeyAngle() : 0);
            };
            this.reset = function(){
                key.reset();
                if(ori){ori.reset();}
            };
        }
        var inputDevice = new InputDevice();


        //
        // High Score(Cookie Save Load)
        //

        var HIGHSCORE_KEY = "misohena.js_skigame.highscore";
        var highScore = loadHighScore();
        function saveHighScore(value)
        {
            document.cookie = HIGHSCORE_KEY + "=" + value + "; max-age="+60*60*24*365;
            document.cookie = "a=a; max-age="+60*60*24*365;
            document.cookie = "z=bbb; max-age="+60*60*24*365;

        }
        function loadHighScore()
        {
            var match = new RegExp("^(?:|.*;\\s*)" + HIGHSCORE_KEY.replace(".","\\.","g") + "\\s*=\\s*([^;]*).*").exec(document.cookie);
            if(match){
                var score = parseInt(match[1],10);
                if(!isNaN(score)){
                    return score;
                }
            }
            return 0;
        }



        //
        // Game Model Utility
        //
        function intersectsRect(r1, r2)
        {
            return r1.x1 > r2.x0 &&
                r1.x0 < r2.x1 &&
                r1.y1 > r2.y0 &&
                r1.y0 < r2.y1;
        }
        function findObjectByRect(objectArray, rect)
        {
            for(var i = 0; i < objectArray.length; ++i){
                var o = objectArray[i];
                if(o && intersectsRect(o.getRect(), rect)){
                    return o;
                }
            }
            return null;
        }
        function stepObjects(objectArray)
        {
            for(var i = 0; i < objectArray.length; ++i){
                if(objectArray[i]){
                    if(!objectArray[i].step()){
                        objectArray[i] = null;
                    }
                }
            }
            removeNull(objectArray);
        }
        function removeNull(objectArray)
        {
            var dst = 0;
            var src;
            for(src = 0; src < objectArray.length; ++src){
                if(objectArray[src]){
                    if(dst != src){
                        objectArray[dst] = objectArray[src];
                    }
                    ++dst;
                }
            }
            objectArray.splice(dst, src - dst);
        }


        //
        // Game Model
        //

        function Game()
        {
            //
            // Life & Damage
            //
            var MAX_DAMAGE_TIME = 10*16;
            var damageTime = 0;
            function addDamage()
            {
                if(damageTime == 0){
                    damageTime = MAX_DAMAGE_TIME;
                    --life;
                    if(life <= 0){
                        life = 0;
                    }
                }
            }
            this.getLife = getLife;
            function getLife()
            {
                return life;
            }
            function stepDamageEffect(dt)
            {
                if(damageTime){
                    damageTime -= dt;
                    if(damageTime < 0){
                        damageTime = 0;
                    }
                }
            }
            this.clearDamageEffect = clearDamageEffect;
            function clearDamageEffect()
            {
                damageTime = 0;
            }

            //
            // Score
            //

            function incScore(amount)
            {
                if(amount > 0){
                    score += amount;
                    if(score > highScore){
                        highScore = score;
                    }
                }
            }
            function decScore(amount)
            {
                if(amount > 0){
                    score -= amount;
                    if(score < 0){
                        score = 0;
                    }
                }
            }

            //
            // Skier
            //

            var SKIER_POS_Y_ON_SCREEN = SCREEN_H*1/3;
            function Skier()
            {
                var x = 0;
                var y = SKIER_POS_Y_ON_SCREEN;
                var vx = 0;
                var vy = 4;
                var RADIUS_X = 16;
                var RADIUS_Y = 24;
                this.getX = function() { return x;};
                this.getY = function() { return y;};
                this.getRadiusX = function(){ return RADIUS_X;};
                this.getRadiusY = function(){ return RADIUS_Y;};
                this.getRect = getRect;
                function getRect()
                {
                    return {x0:x-RADIUS_X,y0:y,x1:x+RADIUS_X,y1:y+RADIUS_Y};
                }
                function step(dt)
                {
                    var tscale = dt/16;

                    var inputAcc = Math.sin(inputDevice.getKeyAngle()*(Math.PI/180)) * 20;
                    vx += inputAcc * tscale;
                    var drag = Math.min(
                        0.00 + Math.abs(vx*0.1) + vx*vx*0.015,
                        Math.abs(vx));
                    vx += (vx > 0 ? -1 : 1) * drag * tscale;

                    x += vx * tscale;
                    y += vy * tscale;
                    if(x < -SCREEN_W/2){
                        x = -SCREEN_W/2;
                    }
                    if(x > SCREEN_W/2){
                        x = SCREEN_W/2;
                    }

                    var myRect = getRect();

                    var wallDir = road.intersectsRect(myRect);
                    if(wallDir){
                        addDamage();
                        vx += -wallDir * 5;
                    }

                    skiTrack.addPoint(x-RADIUS_X, x+RADIUS_X, y-RADIUS_Y);
                }
                this.step = step;
            }
            function SkiTrack()
            {
                var points = [];
                this.addPoint = addPoint;
                function addPoint(l,r,y)
                {
                    points.push({l:l,r:r,y:y});

                    while(points.length > 0 && points[0].y < visibleArea.getLowerY()){
                        points.splice(0,1);
                    }
                }
                this.getPointCount = getPointCount;
                function getPointCount(){ return points.length;}
                this.getPoint = getPoint;
                function getPoint(i){return points[i];}
            }

            //
            // Gate
            //

            var GATE_RADIUS = 8;
            var POLE_X = 64;
            var POLE_R = 8;
            function Gate(x, y)
            {
                var checked = false;
                var miss = false;
                this.getX = function() { return x;};
                this.getY = function() { return y;};
                this.getPoleX = function(){ return POLE_X;};
                this.getPoleRadius = function(){ return POLE_R;};
                this.isChecked = function(){return checked;};
                this.isMiss = function(){return miss;};
                function getRect(){return {x0:x-POLE_X-POLE_R,y0:y-POLE_R,x1:x+POLE_X+POLE_R,y1:y+POLE_R};}
                function getRectLeftPole(){return {x0:x-POLE_X-POLE_R,y0:y-POLE_R,x1:x-POLE_X+POLE_R,y1:y+POLE_R};}
                function getRectRightPole(){return {x0:x+POLE_X-POLE_R,y0:y-POLE_R,x1:x+POLE_X+POLE_R,y1:y+POLE_R};}
                function getRectWithoutPole(){return {x0:x-POLE_X+POLE_R,y0:y-POLE_R,x1:x+POLE_X-POLE_R,y1:y+POLE_R};}
                function check(){
                    if(!checked){
                        checked = true;
                        incScore(10);
                    }
                }
                this.step = step;
                function step(){
                    var skierRect = skier.getRect();
                    if(intersectsRect(skierRect, getRect())){
                        if(intersectsRect(skierRect, getRectWithoutPole())){
                            check();
                        }
                        if(intersectsRect(skierRect, getRectLeftPole()) ||
                           intersectsRect(skierRect, getRectRightPole())){
                            addDamage();
                        }
                    }
                    if(y + POLE_R < skier.getY() - skier.getRadiusY()){
                        if(!checked && !miss){
                            miss = true;
                            decScore(5);
                        }
                    }
                    return y + POLE_R >= visibleArea.getLowerY();
                }
            }
            function GateGenerator()
            {
                var next = 10*16;

                this.step = function(dt){
                    next -= dt;
                    if(next<= 0){
                        next = 16*Math.round(
                            time < 90000 ? 100-40*time/90000 :
                            (20+40*(100000/(100000+(time-90000)))) + (Math.random() * 40 - 20));

                        var roadW = roadGenerator.getRadius() * 2 - POLE_X;
                        var x = Math.random() * roadW - roadW/2 + roadGenerator.getCenterX();
                        gates.push(new Gate(x, visibleArea.getUpperY() + GATE_RADIUS*2));
                    }
                };
            }

            //
            // Road
            //

            function Road()
            {
                var SPAN_H = 16;
                var xs = []; //centerXs
                var rs = []; //radiuses
                var y = 0;
                function addSpan(x, r)
                {
                    xs.push(x);
                    rs.push(r);
                }
                function removeSpan(count)
                {
                    if(count === undefined){ count = 1;}
                    xs.splice(0,count);
                    rs.splice(0,count);
                    y += SPAN_H * count;
                }
                function getLowerY(){ return y;}
                function getUpperY(){ return y + (xs.length - 1) * SPAN_H;}
                function getSpanCount(){ return xs.length;}
                function removeSpanPassed()
                {
                    var passedH = Math.floor((visibleArea.getLowerY() - getLowerY()) / SPAN_H);
                    if(passedH > 0){
                        removeSpan(Math.floor(passedH / SPAN_H));
                    }
                }
                function intersectsRect(rect)
                {
                    var lower = Math.max(getLowerY(), rect.y0);
                    var upper = Math.min(getUpperY(), rect.y1);
                    if(lower >= upper){
                        return 0;
                    }
                    var lowerSpan = Math.min(Math.ceil((lower - getLowerY()) / SPAN_H), getSpanCount());
                    var upperSpan = Math.min(Math.floor((upper - getLowerY()) / SPAN_H), getSpanCount());
                    if(lowerSpan >= upperSpan){
                        return 0;
                    }
                    for(var i = lowerSpan; i <= upperSpan; ++i){
                        var left = xs[i] - rs[i];
                        var right = xs[i] + rs[i];
                        if(rect.x0 < left){
                            return -1;
                        }
                        if(rect.x1 > right){
                            return 1;
                        }
                    }
                    return 0;
                }
                this.addSpan = addSpan;
                this.removeSpan = removeSpan;
                this.getLowerY = getLowerY;
                this.getUpperY = getUpperY;
                this.removeSpanPassed = removeSpanPassed;
                this.intersectsRect = intersectsRect;
                this.getSpanHeight = function(){return SPAN_H;};
                this.getSpanCount = getSpanCount;
                this.getSpanCenter = function(i){return xs[i];};
                this.getSpanRadius = function(i){return rs[i];};
            }
            function RoadGenerator(road)
            {
                var centerX = 0;
                var radius = SCREEN_W*2/6;
                var leftLimit = -SCREEN_W/2 + SCREEN_W/32;
                var rightLimit = SCREEN_W/2 - SCREEN_W/32;
                fillVisibleAreaWithSpan();
                function extendRoad()
                {
                    road.addSpan(centerX, radius);

                    var dir = Math.round((Math.random() - 0.5)*6) * 8;
                    centerX += dir;
                    if(centerX - radius < leftLimit){
                        centerX = leftLimit + radius;
                    }
                    if(centerX + radius > rightLimit){
                        centerX = rightLimit - radius;
                    }
                }
                function fillVisibleAreaWithSpan()
                {
                    var emptyH = Math.ceil((visibleArea.getUpperY() - road.getUpperY()) / road.getSpanHeight()) + 1;
                    if(emptyH > 0){
                        for(var i = 0; i < emptyH; ++i){
                            extendRoad();
                        }
                    }
                }
                this.step = function(){
                    fillVisibleAreaWithSpan();
                    road.removeSpanPassed();
                };
                this.getRadius = function(){ return radius;};
                this.getCenterX = function(){ return centerX;};
            }
            function VisibleArea(){
                this.getLowerY = getLowerY;
                function getLowerY() { return skier.getY() - SKIER_POS_Y_ON_SCREEN;}
                this.getUpperY = getUpperY;
                function getUpperY() { return getLowerY() + SCREEN_H;}
            }


            //
            // Game Objects
            //

            var score = 0;
            var time = 0;
            var life = 10;
            var skier = new Skier();
            var skiTrack = new SkiTrack();
            var road = new Road();
            var gates = [];
            var visibleArea = new VisibleArea();
            var roadGenerator = new RoadGenerator(road);
            var gateGenerator = new GateGenerator();


            this.step = step;
            function step(dt)
            {
                time += dt;
                roadGenerator.step();
                gateGenerator.step(dt);
                stepObjects(gates);
                skier.step(dt);
                stepDamageEffect(dt);
                drawField();
            }

            //
            // View
            //

            this.drawField = drawField;
            function drawField()
            {
                var ctx = canvas.getContext("2d");
                ctx.fillStyle = "white";
                ctx.fillRect(0,0,SCREEN_W, SCREEN_H);

                function drawWall(sign)
                {
                    var viewPosY = visibleArea.getLowerY();
                    var spanY = road.getLowerY();
                    var spanCount = road.getSpanCount();
                    ctx.beginPath();
                    ctx.moveTo(SCREEN_W/2+SCREEN_W/2*sign, SCREEN_H);
                    for(var i = 0; i < spanCount; ++i, spanY += road.getSpanHeight()){
                        var x = road.getSpanCenter(i);
                        var r = road.getSpanRadius(i);
                        ctx.lineTo(SCREEN_W/2+x+r*sign, SCREEN_H - (spanY - viewPosY));
                    }
                    ctx.lineTo(SCREEN_W/2+SCREEN_W/2*sign, 0);
                    ctx.closePath();
                    ctx.strokeStyle = "";
                    ctx.fillStyle = "black";
                    ctx.fill();
                }
                drawWall(-1);
                drawWall(1);

                function toCanvasX(x){ return SCREEN_W/2 + x;}
                function toCanvasY(y){ return SCREEN_H - (y - visibleArea.getLowerY());}

                function drawSkiTrack()
                {
                    function drawTrackLine(xgetter){
                        var count = skiTrack.getPointCount();
                        if(count <= 0){
                            return;
                        }
                        ctx.beginPath();
                        ctx.moveTo(toCanvasX(xgetter(skiTrack.getPoint(0))), toCanvasY(skiTrack.getPoint(0).y));
                        for(var i = 1; i < count; ++i){
                            ctx.lineTo(toCanvasX(xgetter(skiTrack.getPoint(i))), toCanvasY(skiTrack.getPoint(i).y));
                        }
                        ctx.strokeStyle = "#c0c0c0";
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }
                    drawTrackLine(function(pt){return pt.l;});
                    drawTrackLine(function(pt){return pt.r;});
                }
                drawSkiTrack();

                function drawSkier()
                {
                    var rx = skier.getRadiusX();
                    var ry = skier.getRadiusY();
                    ctx.beginPath();
                    ctx.arc(toCanvasX(skier.getX()), toCanvasY(skier.getY()), rx/2, 0, 2*Math.PI, false);
                    ctx.fillStyle = "black";
                    ctx.fill();
                    ctx.fillRect(toCanvasX(skier.getX() - rx-1), toCanvasY(skier.getY() + ry), 2, ry*2);
                    ctx.fillRect(toCanvasX(skier.getX() + rx-1), toCanvasY(skier.getY() + ry), 2, ry*2);
                }
                drawSkier();

                function drawGate(gate)
                {
                    var x = gate.getX();
                    var y = gate.getY();
                    var poleX = gate.getPoleX();
                    var poleRadius = gate.getPoleRadius();
                    var barX = poleX - poleRadius*2;
                    ctx.fillStyle = gate.isChecked() ? "green" : gate.isMiss() ? "red" : "black";
                    ctx.fillRect(toCanvasX(x - poleX)-poleRadius, toCanvasY(y)-poleRadius, poleRadius*2, poleRadius*2);
                    ctx.fillRect(toCanvasX(x + poleX)-poleRadius, toCanvasY(y)-poleRadius, poleRadius*2, poleRadius*2);
                    ctx.fillRect(toCanvasX(x - barX), toCanvasY(y)-1, barX*2, 2);
                }
                function drawGates()
                {
                    for(var i = 0; i < gates.length; ++i){
                        drawGate(gates[i]);
                    }
                }
                drawGates();

                function drawDamageEffect()
                {
                    if(damageTime){
                        ctx.fillStyle = "rgba(255,0,0," + (damageTime / MAX_DAMAGE_TIME).toFixed(3) + ")";
                        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
                    }
                }
                drawDamageEffect();

                function drawStatus()
                {
                    ctx.textBaseline = "top";
                    ctx.textAlign = "left";
                    ctx.font = "bold 16px arial,sans-serif";
                    ctx.fillStyle = "gray";
                    ctx.fillText("HISCORE:" + highScore,50,10);
                    ctx.fillText("SCORE:" + score,200,10);
                    ctx.fillText(
                        "TIME:" +
                            ("0"+Math.floor(time/60000)%60).substr(-2)+":"+
                            ("0"+Math.floor(time/1000)%60).substr(-2)+"."+
                            ("00"+time%1000).substr(-3),
                        350,10);
                    ctx.fillText("LIFE:" + life,500,10);
                }
                drawStatus();
            }
        }
        var game = null;


        //
        // Game Modes
        //
        // -> Title -> GetReady -> Playing -> GameOver
        //      ^                               |
        //      +-------------------------------+
        //

        function modeTitle(){
            game = new Game();
            function draw(){
                game.drawField();
                var ctx = canvas.getContext("2d");
                ctx.font = "20px arial,sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "rgb(" +
                    Math.floor(Math.random()*256) + "," +
                    Math.floor(Math.random()*256) + "," +
                    Math.floor(Math.random()*256) + ")";
                ctx.fillText("CLICK TO START", SCREEN_W/2, SCREEN_H/2);
            }
            var onClick = function(ev){
                nextMode();
            };
            var onKeyDown = function(ev){
                if(ev.keyCode == 13){
                    ev.stopPropagation();
                    ev.preventDefault();
                    nextMode();
                }
            };
            function nextMode(){
                gameScreen.getElement().removeEventListener("click", onClick, false);
                gameScreen.getElement().removeEventListener("keydown", onKeyDown, false);
                clearInterval(intervalId);
                modeGetReady();
            }
            gameScreen.getElement().addEventListener("click", onClick, false);
            gameScreen.getElement().addEventListener("keydown", onKeyDown, false);
            var intervalId = setInterval(draw, 50);
        }
        function modeGetReady(){
            var t = 3000;
            function draw(){
                game.drawField();
                var ctx = canvas.getContext("2d");
                var r = Math.floor(256*(t%1000)/1000);
                ctx.fillStyle = "rgb(" + r + "," + Math.floor(r/2) + ",0)";
                ctx.fillRect(0,SCREEN_H/2-20, SCREEN_W, 40);

                ctx.font = "20px arial,sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "white";
                ctx.fillText("GET READY...", SCREEN_W/2, SCREEN_H/2);
            }
            function step(){
                t -= 50;
                if(t <= 0){
                    clearInterval(intervalId);
                    modePlaying();
                }
                draw();
            }
            var intervalId = setInterval(step, 50);
        }
        function modePlaying(){
            inputDevice.reset();

            var STEP_PERIOD = 16;
            var requestAnimationFrame =
                    window.requestAnimationFrame ||
                    window.mozRequestAnimationFrame ||
                    window.webkitRequestAnimationFrame ||
                    window.msRequestAnimationFrame;
            var cancelAnimationFrame =
                    window.cancelAnimationFrame ||
                    window.mozCancelAnimationFrame;
            if(!requestAnimationFrame || !cancelAnimationFrame){
                requestAnimationFrame = function(cb){return window.setTimeout(cb, STEP_PERIOD);};
                cancelAnimationFrame = function(id){return window.clearTimeout(id);};
            }
            else{
                console.log("use requestAnimationFrame");
            }

            var lastTime = Date.now();
            function step(dt)
            {
                game.step(dt);
                if(game.getLife() <= 0){
                    nextMode();
                    return false;
                }
                return true;
            }
            function onTimer()
            {
                nextTimer();

                var currTime = Date.now();
                if(currTime < lastTime || currTime - lastTime > 100){
                    lastTime = currTime - STEP_PERIOD;
                }

                if(true){
                    //fixed frame rate
                    while(lastTime < currTime){
                        lastTime += STEP_PERIOD;

                        if(!step(STEP_PERIOD)){
                            return;
                        }
                    }
                }
                else{
                    // variable frame rate
                    step(currTime - lastTime);
                }
                lastTime = currTime;
            }
            var timerId = null;;
            function startTimer(){
                if(timerId === null){
                    timerId = requestAnimationFrame(onTimer);
                }
            }
            function nextTimer(){
                timerId = null;
                startTimer();
            }
            function stopTimer(){
                if(timerId !== null){
                    cancelAnimationFrame(timerId);
                    timerId = null;
                }
            }
            var togglePause = function(){
                if(timerId === null){
                    startTimer();
                }
                else{
                    stopTimer();
                }
            };
            var nextMode = function(){
                menuPauseButton.removeEventListener("click", togglePause, false);
                menuGiveUpButton.removeEventListener("click", nextMode, false);
                stopTimer();
                modeGameOver();
            };
            menuPauseButton.addEventListener("click", togglePause, false);
            menuGiveUpButton.addEventListener("click", nextMode, false);
            startTimer();
        }
        function modeGameOver(){
            saveHighScore(highScore);

            game.clearDamageEffect();
            function drawFlash(){
                var ctx = canvas.getContext("2d");
                ctx.fillStyle = "rgba(255,0,0," + (1.0 - (t % 150)/150).toFixed(3) + ")";
                ctx.fillRect(0,0,SCREEN_W, SCREEN_H);
            }

            function drawCaption(){
                var ctx = canvas.getContext("2d");
                ctx.fillStyle = "black";
                ctx.fillRect(0,SCREEN_H/2-20, SCREEN_W, 40);

                ctx.font = "20px arial,sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "white";
                ctx.fillText("GAME OVER", SCREEN_W/2, SCREEN_H/2);
            }
            var t = 0;
            function step(){
                t += 50;
                game.drawField();
                if(t < 1000){
                    drawFlash();
                }
                else{
                    drawCaption();
                    stopTimer();
                }
            }
            function stopTimer(){
                if(intervalId !== null){
                    clearInterval(intervalId);
                    intervalId = null;
                }
            }
            var onClick = function(ev){
                nextMode();
            };
            var onKeyDown = function(ev){
                if(ev.keyCode == 13){
                    ev.stopPropagation();
                    ev.preventDefault();
                    nextMode();
                }
            };
            function nextMode(){
                gameScreen.getElement().removeEventListener("click", onClick, false);
                gameScreen.getElement().removeEventListener("keydown", onKeyDown, false);
                stopTimer();
                modeTitle();
            }
            gameScreen.getElement().addEventListener("click", onClick, false);
            gameScreen.getElement().addEventListener("keydown", onKeyDown, false);
            var intervalId = setInterval(step, 50);
        }
        modeTitle();



        return gameScreen.getElement();
    }
})(this);
