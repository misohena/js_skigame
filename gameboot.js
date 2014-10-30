// gamescreen.js
// Copyright (c) 2014 AKIYAMA Kouhei
// This software is released under the MIT License.

(function(global){
    if(!global.misohena){global.misohena = {};}
    if(global.misohena.GameBoot){
        return; //already loaded
    }
    global.misohena.GameBoot = {};
    var mypkg = global.misohena.GameBoot;


    //
    // importScript
    //

    function importScriptMulti(srcArray, onLoad, onError)
    {
        var totalCount = 0;
        var loadedCount = 0;
        var errorCount = 0;
        function onLoadInner()
        {
            ++loadedCount;
            if(loadedCount == totalCount){
                if(onLoad){
                    onLoad();
                }
            }
        }
        function onErrorInner()
        {
            ++errorCount;
            if(errorCount == 1){
                if(onError){
                    onError();
                }
            }
        }
        for(var i = 0; i < srcArray.length; ++i){
            if(srcArray[i]){
                ++totalCount;
                importScript(srcArray[i], onLoadInner, onErrorInner);
            }
        }
    }

    var scriptMap = mypkg.scriptMap = {};
    mypkg.importScript = importScript;
    function importScript(src, onLoad, onError)
    {
        if(!src){
            return;
        }
        if(Object.prototype.toString.call(src) === "[object Array]"){
            importScriptMulti(src, onLoad, onError);
            return;
        }

        var scriptInfo = scriptMap[src];
        if(scriptInfo){
            if(scriptInfo.loaded){
                if(onLoad){
                    onLoad();
                }
            }
            else if(scriptInfo.error){
                if(onError){
                    onError();
                }
            }
            else{
                scriptInfo.onLoads.push(onLoad);
            }
        }
        else{
            scriptInfo = scriptMap[src] = {loaded: false, error: false, onLoads: [], onErrors: []};
            if(onLoad){scriptInfo.onLoads.push(onLoad);}
            if(onError){scriptInfo.onLoads.push(onError);}

            function onErrorInner(e)
            {
                scriptInfo.error = true;
                for(var i = 0; i < scriptInfo.onErrors.length; ++i){
                    scriptInfo.onErrors[i]();
                }
            }
            function onLoadInner()
            {
                scriptInfo.loaded = true;
                for(var i = 0; i < scriptInfo.onLoads.length; ++i){
                    scriptInfo.onLoads[i]();
                }
            }
            var head = document.getElementsByTagName("head")[0];
            var script = document.createElement("script");
            script.type = "text/javascript";
            script.onerror = onErrorInner;
            script.onload = onLoadInner;
            script.src = src;
            head.appendChild(script);
        }
    }


    //
    // Loading Mark
    //
    mypkg.createLoadingMark = createLoadingMark;
    function createLoadingMark()
    {
        var mark = document.createElement("div");
        mark.style.position = "absolute";
        mark.style.left = "50%";
        mark.style.top = "50%";
        mark.style.background = "#ff0000";
        var dots = [];
        for(var i = 0; i < 8; ++i){
            var dot = document.createElement("div");

            dot.style.width = 10+"px";
            dot.style.height = 10+"px";
            dot.style.position = "absolute";
            dot.style.left = (-5+([0,1,1,1,0,-1,-1,-1][i])*16)+"px";
            dot.style.top = (-5+([-1,-1,0,1,1,1,0,-1][i])*16)+"px";
            dot.style.background = "#ffffff";
            dot.style.opacity = 0;
            mark.appendChild(dot);
            dots.push(dot);
        }
        var TIMER_INTERVAL = 25;
        var CYCLE = 500;

        var t = 0;
        var intervalId = setInterval(function(){
            t += TIMER_INTERVAL;
            for(var i = 0; i < 8; ++i){
                var tt = t - CYCLE*i/8;
                if(tt >= 0){
                    dots[i].style.opacity = Math.max(0, 1.0 - (tt % CYCLE) / CYCLE);
                }
            }}, TIMER_INTERVAL);
        mark.stop = function(){
            if(intervalId !== undefined){
                clearInterval(intervalId);
                delete intervalId;
            }
            if(mark.parentNode){
                mark.parentNode.removeChild(mark);
            }
        };
        return mark;
    }


    mypkg.addLoadingMarkTo = addLoadingMarkTo;
    function addLoadingMarkTo(element)
    {
        if(!element.style.position || element.style.position == "static"){
            element.style.position = "relative";
        }
        var mark = createLoadingMark();
        element.appendChild(mark);
        return mark;
    }


    //
    // load script and replace preview element.
    //
    // example:
    // // load example.js, replace div to ExampleGame.createElement()
    // <div onclick="loadAndReplace(this, ['example.js'],
    //     function(){return ExampleGame.createElement();})">
    //   <img src="examplegame_preview.jpg">
    // </div>
    //
    mypkg.loadAndReplace = loadAndReplace;
    function loadAndReplace(previewElement, scriptSrc, creator)
    {
        if(!previewElement || !previewElement.parentNode || previewElement.loadingScript){
            return;
        }
        previewElement.loadingScript = true;

        var loadingMark = addLoadingMarkTo(previewElement);

        function findFirstFocusable(elem){
            if(elem.tabIndex >= 0){
                return elem;
            }
            for(var i = 0; i < elem.childNodes.length; ++i){
                var focusableDescendant = findFirstFocusable(elem.childNodes[i]);
                if(focusableDescendant){
                    return focusableDescendant;
                }
            }
            return null;
        }
        function focusFirstFocusable(elem){
            var focusableElem = findFirstFocusable(elem);
            if(focusableElem){
                focusableElem.focus();
            }
        }
        function replaceElement(oldElem, newElem){
            oldElem.parentNode.insertBefore(newElem, oldElem);
            oldElem.parentNode.removeChild(oldElem);
        }
        function onLoad(){
            loadingMark.stop();
            var newElement = creator();
            replaceElement(previewElement, newElement);
            focusFirstFocusable(newElement);
        }
        function onError(){
            loadingMark.stop();
            ///@todo report error
        }
        importScript(scriptSrc, onLoad, onError);
    }


    //
    // Play Button
    //
    // example:
    //
    // <div>
    //   <img src="examplegame_preview.jpg">
    //   <script>writePlayButton(["example.js"], function(){return ExampleGame.createElement();});</script>
    // </div>
    //
    mypkg.writePlayButton = writePlayButton;
    function writePlayButton(scriptSrc, creator)
    {
        function getLastScriptNode()
        {
            var n = document;
            while(n && n.nodeName.toLowerCase() != "script") { n = n.lastChild;}
            return n;
        }
        var BTN_W = 80;
        var BTN_H = 64;
        var FNT_H = BTN_H*0.875;
        var script = document.currentScript || getLastScriptNode();
        var button = document.createElement("div");
        button.style.width = BTN_W+"px";
        button.style.height =
            button.style.lineHeight = BTN_H+"px";
        button.style.fontSize = FNT_H+"px";
        button.style.position = "absolute";
        button.style.left = "50%";
        button.style.top = "50%";
        button.style.color = "black";
        button.style.background = "white";
        button.style.margin = "-"+BTN_H/2+"px 0 0 -"+BTN_W/2+"px";
        button.style.border = "1px solid black";
        button.style.borderRadius = "16px";
        button.style.userSelect =
            button.style.msUserSelect =
            button.style.MozUserSelect =
            button.style.webkitUserSelect = "none";
        button.style.cursor = "default";
        button.style.textAlign = "center";
        button.appendChild(document.createTextNode("\u25b6"));
        script.parentNode.insertBefore(button, script);

        var previewElement = script.parentNode;
        if(!previewElement.style.position || previewElement.style.position == "static"){
            previewElement.style.position = "relative";
        }

        previewElement.addEventListener("click", function(e){
            if(button){
                button.parentNode.removeChild(button);
                button = null;
                loadAndReplace(previewElement, scriptSrc, creator);
            }}, false);
    }

})(this);
