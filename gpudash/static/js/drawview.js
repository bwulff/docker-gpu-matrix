var colors = {
  red : '100',
  green : '010',
  blue : '001',
  cyan: '011',
  purple: '101',
  yellow: '110',
}

var htmlcolors = {
  red : '#FF0000',
  green : '#00FF00',
  blue : '#0000FF',
  cyan: '#00FFFF',
  purple: '#FF00FF',
  yellow: '#FFFF00'
}

var backgroundImageURL = "/volume/" + config.volume.name + "/raw/" + config.perspective + "/slice_" + config.slice + ".png";
var annotationImageURL = "/volume/" + config.volume.name + "/" + config.aspect + "/" + config.perspective + "/slice_" + config.slice + ".png";
var postAnnotationURL = "/volume/" + config.volume.name + "/" + config.aspect + "/" + config.perspective + "/slice_" + config.slice + ".base64png";
var commentURL = "/comments/" + config.volume.name + "/" + config.perspective + "/s_" + config.slice + ".json";

var contentPane = document.getElementById('content');
var drawPane = document.getElementById('drawPane');
var ctx = drawPane.getContext("2d");
ctx.imageSmoothingEnabled = true;
var undoImage = false;
var nextCommentId = 1;
var comments = [];

// Application State
var State = function() {
    this.changesMade = false;
    this.slice = config.slice;
    this.tool = "draw";
    this.raw = true;
    this.comments = false;
    this.coloring = "red";
    this.linewidth = 3;
    this.slice_back = function() {
      loadSlice(config.slice-1);
    }
    this.slice_forward = function() {
      loadSlice(config.slice+1);
    }
    this.undo = function() {
      if (undoImage) {
        console.log("undo");
        ctx.putImageData(undoImage,0,0);
      }
    }
    this.save = function() {
      if (confirm('Write current annotation to the database.\n\nProceed?')) {
        var canvasData = drawPane.toDataURL("image/png");
        //console.log(canvasData);
        var ajax = new XMLHttpRequest();
        ajax.open("PUT", postAnnotationURL, false);
        ajax.onreadystatechange = function() {
            if (ajax.responseText == 'OK') {
              alert("Annotation slice successfully saved to database.")
            }
            console.log(ajax.responseText);
        }
        ajax.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        ajax.send("imgData="+canvasData);
      }
    }
    this.download = function() {
      // create new canvas
      var tmp = document.createElement('canvas');
      tmp.width = config.image.width;
      tmp.height = config.image.height;
      var tmpctx = tmp.getContext("2d");

      // draw background image to canvas
      tmpctx.drawImage(img, 0, 0);

      // overlay annotation image
      current = ctx.getImageData(0,0,annotationImage.width,annotationImage.height);
      // make a pixel of the color that is currently chosen
      var pixel = tmpctx.createImageData(1,1);
      var c = colors[state.coloring].split("");
      for (var i=0; i<3; i++) {
        if (c[i] == '1') {
          pixel.data[i] = 255
        } else {
          pixel.data[i] = 0;
        }
      }
      pixel.data[3] = 255;
      // do the overlay
      for (var y=0; y<config.image.height; y++) {
        for (var x=0; x<config.image.width; x++) {
          if (current.data[y*config.image.width*4+x*4+3] > 0) {
            tmpctx.putImageData(pixel, x, y)
          }
        }
      }

      // get DataURL
      var canvasData = tmp.toDataURL("image/png");

      // open new window with image
      window.open(canvasData);
    }
}

// create Application state
var state = new State();

// create Controls
var menu = new dat.GUI({ autoPlace: false });
var slice_back = menu.add(state, 'slice_back');
var sliceCtrl = menu.add(state, 'slice');
var slice_forward = menu.add(state, 'slice_forward');
var rawCtrl = menu.add(state, 'raw');
var commentCtrl = menu.add(state, 'comments');
var colorCtrl = menu.add(state, 'coloring', ['red','green','blue','cyan','purple','yellow']);
var toolCtrl = menu.add(state, 'tool', ['draw','erase','line','fill','comment']);
menu.add(state, 'linewidth', 1, 50).step(1);
menu.add(state, 'undo');
menu.add(state, 'download');
menu.add(state, 'save');
document.getElementById('controls-container').appendChild(menu.domElement);

sliceCtrl.onChange(function(slice) {
  loadSlice(slice);
});

rawCtrl.onChange(function(showBackground) {
  if (showBackground) {
    console.log("background on")
    drawPane.style.background = "url(" + backgroundImageURL + ")";
  } else {
    console.log("background off");
    drawPane.style.background = "black";
  }
});

commentCtrl.onChange(function(showComments) {
  if (showComments) {
    for (var key in comments) {
      if (comments.hasOwnProperty(key)) {
        var comment = comments[key];
        comment.icon.style.zIndex = 2;
        comment.icon.style.display = 'block';
      }
    }
  } else {
    for (var key in comments) {
      if (comments.hasOwnProperty(key)) {
        var comment = comments[key];
        comment.icon.style.zIndex = -1;
        comment.icon.style.display = 'none';
      }
    }
  }
});

toolCtrl.onChange(function(tool) {
});

colorCtrl.onChange(function(color) {
  redraw();
});

console.log("setting draw pane size to " + config.image.width + "x" + config.image.height);
drawPane.width = config.image.width;
drawPane.height = config.image.height;

// load comment icon so it is in cache
var comment_icon = new Image();
//comment_icon.src = '/static/img/balloon-ellipsis.png';
comment_icon.src = '/static/img/comment.svg';

// load slice as background and adjust canvas dimensions to slice dimensions
var img = new Image()
img.onload = function() {
  console.log("slice loaded: " + config.slice);
  drawPane.style.background = "url(" + this.src + ")";
}
img.src = backgroundImageURL;

// load the annotation into the canvas
var annotationImage = new Image();
annotationImage.onload = function() {
  console.log("annotation loaded: " + config.aspect + ":" + config.slice);
  ctx.drawImage(annotationImage, 0, 0);
  var imgData=ctx.getImageData(0,0,this.width,this.height);
  for (var i=0;i<imgData.data.length;i+=4) {
    var c = imgData.data[i] + imgData.data[i+1] + imgData.data[i+2];
    if (c == 0) {    // add a threshold here?
      imgData.data[i+3] = 0;
    }
  }
  ctx.putImageData(imgData,0,0);
  redraw();
}
annotationImage.src = annotationImageURL;

var toggleCommentBox = function() {
  var comment = comments[this.dataset.id];
  if (comment.box.style.display == 'none') {
    comment.box.style.zIndex = 3;
    comment.box.style.display = 'block';
  } else {
    comment.box.style.zIndex = -3;
    comment.box.style.display = 'none';
  }
}

var deleteComment = function(id) {
  console.log("deleting comment " + id);
  var ajax = new XMLHttpRequest();
  ajax.open("DELETE", commentURL, false);
  ajax.onreadystatechange = function() {
    if (ajax.status == 200) {
      console.log(ajax.responseText);
      var id=ajax.responseText;
      var comment = comments[id];
      console.log("removing comment " + id);
      contentPane.removeChild(comment.icon);
      contentPane.removeChild(comment.box);
      delete comments[id];
    }
  }
  ajax.setRequestHeader('Content-Type', 'application/json');
  var comment = {id:id}
  ajax.send(JSON.stringify(comment));
}

// prepare comments
var ajax = new XMLHttpRequest();
ajax.open("GET", commentURL, false);
ajax.setRequestHeader('Content-Type', 'application/json');
ajax.onreadystatechange = function() {
  if (this.readyState == 4 && this.status == 200) {
    var data = JSON.parse(this.responseText);
    for (var key in data) {

      comment = data[key];
      // preapre icon
      console.log("adding comment icon for " + comment.id);
      var elm = createCommentIcon(key, comment);
      comment.icon = elm;

      // prepare comment box
      var box = createCommentBox(key, comment);
      comment.box = box;

      comments.push(comment);

    }
  }
}
ajax.send(null);

var mousePressed = false;
var lastPos = false;

drawPane.addEventListener("mousedown", function(e) {
  console.log("begin " + state.tool);
  undoImage = ctx.getImageData(0,0,annotationImage.width,annotationImage.height);
  var mouseX = e.pageX - drawPane.offsetLeft;
  var mouseY = e.pageY - drawPane.offsetTop;
  lastPos = {x:mouseX, y:mouseY};
  if (state.tool == "comment") {
    var comment_text = prompt("Enter comment:");
    if (comment_text == null) {
      console.log("abort create comment");
      return false;   // user hit cancel
    }
    console.log("creating comment at " + mouseX + ":" + mouseY);
    var ajax = new XMLHttpRequest();
    ajax.open("POST", commentURL, false);
    ajax.onreadystatechange = function() {
        if (ajax.status == 200) {
          console.log(ajax.responseText);
          var comment = {
            id:ajax.responseText,
            x: mouseX, y: mouseY,
            user: config.user_name,
            text: comment_text,
            icon: false,
            box: false
          }
          comment.icon = createCommentIcon(ajax.responseText, comment);
          comment.icon.style.display = 'block';
          comment.icon.style.zIndex = 1;
          comment.box = createCommentBox(ajax.responseText, comment);
          console.log(comment)
          comments[ajax.responseText] = comment;
        }
    }
    ajax.setRequestHeader('Content-Type', 'application/json');
    var comment = {
      x: mouseX,
      y: mouseY,
      z: config.slice,
      origin: config.perspective,
      user: config.user_name,
      text: comment_text
    }
    ajax.send(JSON.stringify(comment));
    return false;
  }
  if (state.tool == 'draw' || state.tool == "line") {
    state.changesMade = true;
    ctx.globalCompositeOperation="source-over";
    ctx.strokeStyle = htmlcolors[state.coloring];
  } else if (state.tool == 'erase') {
    state.changesMade = true;
    ctx.globalCompositeOperation="destination-out";
  } else if (state.tool == 'fill') {
    console.log('filling at x=' + mouseX + ' y=' + mouseY);
    fillArea(ctx, mouseX, mouseY, colors[state.coloring].split(""));
    state.changesMade = true;
  }
  ctx.lineWidth = state.linewidth;
  ctx.lineJoin="round";
  mousePressed = true;
  return false;
});

drawPane.addEventListener("mouseup", function() {
  if (state.tool != 'comment') {
    console.log("end " + state.tool);
  }
  lastPos = false;
  mousePressed = false;
  return false;
});

drawPane.addEventListener("mousemove", function(e) {
  var mouseX = e.pageX - drawPane.offsetLeft;
  var mouseY = e.pageY - drawPane.offsetTop;
  if (state.tool == 'comment') {
    return false;
  }
  if (mousePressed && lastPos) {
    if (state.tool == 'line') {
      ctx.putImageData(undoImage,0,0);
    }
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(mouseX, mouseY);
    ctx.closePath();
    ctx.stroke();
    if (state.tool == 'draw' || state.tool == 'erase') {
      lastPos.x = mouseX;
      lastPos.y = mouseY;
    }
  }
  return false;
});

if (drawPane.addEventListener) {
  // IE9, Chrome, Safari, Opera
  drawPane.addEventListener("mousewheel", MouseWheelHandler, false);
  // Firefox
  drawPane.addEventListener("DOMMouseScroll", MouseWheelHandler, false);
} else drawPane.attachEvent("onmousewheel", MouseWheelHandler); // IE 6/7/8

function MouseWheelHandler(e) {
  // cross-browser wheel delta
  var e = window.event || e; // old IE support
  var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
  //myimage.style.width = Math.max(50, Math.min(800, myimage.width + (30 * delta))) + "px";
  console.log("wheel delta: " + delta);
  //ctx.scale(delta*2, delta*2);
  redraw();
  return false;
}

function redraw() {
  var imgData=ctx.getImageData(0,0,annotationImage.width,annotationImage.height);
  console.log("applying coloring: " + state.coloring);
  for (var i=0;i<imgData.data.length;i+=4) {
    if (imgData.data[i+3] > 0) {
      var c = colors[state.coloring].split("");
      for (var j=0;j<3;j++) {
        if (c[j] == '1') {
          imgData.data[i+j] = 255;
        } else {
          imgData.data[i+j] = 0;
        }
      }
    }
  }
  ctx.putImageData(imgData,0,0);
}

function createCommentIcon(id, comment) {
  var elm = document.createElement('div');
  elm.setAttribute('data-id', id);
  elm.onclick = toggleCommentBox;
  elm.style.position = "absolute";
  elm.style.margin = '0px';
  //elm.style.background = 'url(/static/img/balloon-ellipsis.png)';
  elm.style.background = 'url(/static/img/comment.svg)';
  elm.style.cursor = 'pointer';
  elm.style.backgroundSize = 'cover';
  elm.style.width = '16px';
  elm.style.height = '16px';
  elm.style.left = (drawPane.offsetLeft + comment.x - 8) + 'px';
  elm.style.top = (drawPane.offsetTop + comment.y - 8) + 'px';
  elm.style.display = 'none';   // hide icon
  elm.style.zIndex = -1;        // and put behind canvas
  contentPane.appendChild(elm);
  return elm;
}

function createCommentBox(id, comment) {
  var temp = document.querySelector('#comment-template');
  var tempContainer = temp.content.querySelector('.comment-box');
  var tempUsername = temp.content.querySelector('.comment-username');
  var tempMessage = temp.content.querySelector('.comment-message');
  var tempDelete = temp.content.querySelector('.comment-delete');

  //prepare comment box
  tempDelete.setAttribute('href','javascript:deleteComment("' + id + '")');
  tempUsername.innerHTML = comment.user + ':';
  tempMessage.innerHTML = comment.text;
  tempContainer.style.position = "absolute";
  tempContainer.style.left = (drawPane.offsetLeft + comment.x + 8) + 'px';
  tempContainer.style.top = (drawPane.offsetTop + comment.y - 8) + 'px';
  tempContainer.style.display = 'none';   // hide icon
  tempContainer.style.zIndex = -1;        // and put behind canvas
  var commentId = 'comment-' + id
  tempContainer.setAttribute('id', commentId);
  var clone = document.importNode(temp.content, true);
  contentPane.appendChild(clone);

  // 'manually' search for the newly create element because HTML5 is retarded
  for (var i=0; i<contentPane.childNodes.length; i++) {
    if (contentPane.childNodes[i].id == commentId) {
      return contentPane.childNodes[i];
    }
  }
}

function loadSlice(slice) {
  if (slice <= 0) return;
  if (config.perspective == 'timeslice' && slice > config.volume.depth) return;
  if (config.perspective == 'inline' && slice > config.volume.width) return;
  if (config.perspective == 'crossline' && slice > config.volume.height) return;
  if (state.changesMade && !confirm('There are unsafed changes on the current slice. Proceed?')) return;

  window.location.href = config.baseURL + '/edit/' + config.volume.name + '/' + config.aspect + '/' + config.perspective + '/' + slice;
}

function fillArea(ctx, startX, startY, fillColor) {
  canvasWidth = ctx.canvas.width
  canvasHeight = ctx.canvas.height
  pixelStack = [[startX, startY]];
  colorLayer = ctx.getImageData(0,0, canvasWidth, canvasHeight)

  drawingBoundTop = 0   // ??
  while (pixelStack.length) {
    var newPos, x, y, pixelPos, reachLeft, reachRight;
    newPos = pixelStack.pop();
    x = newPos[0];
    y = newPos[1];

    pixelPos = (y*canvasWidth + x) * 4;
    while (y-- >= drawingBoundTop && matchFillBackground(pixelPos, colorLayer, fillColor)) {
      pixelPos -= canvasWidth * 4;
    }
    pixelPos += canvasWidth * 4;
    ++y;
    reachLeft = false;
    reachRight = false;
    while (y++ < canvasHeight-1 && matchFillBackground(pixelPos, colorLayer, fillColor)) {
      // color pixel
      for (var j=0;j<3;j++) {
        if (fillColor[j] == '1') {
          colorLayer.data[pixelPos+j] = 255;
        } else {
          colorLayer.data[pixelPos+j] = 0;
        }
      }
      colorLayer.data[pixelPos+3] = 255;

      if (x > 0) {
        if (matchFillBackground(pixelPos - 4, colorLayer, fillColor)) {
          if (!reachLeft) {
            pixelStack.push([x - 1, y]);
            reachLeft = true;
          }
        }
        else if (reachLeft) {
          reachLeft = false;
        }
      }

      if (x < canvasWidth-1) {
        if(matchFillBackground(pixelPos + 4, colorLayer, fillColor)) {
          if(!reachRight) {
            pixelStack.push([x + 1, y]);
            reachRight = true;
          }
        }
        else if (reachRight) {
          reachRight = false;
        }
      }

      pixelPos += canvasWidth * 4;
    }
  }
  ctx.putImageData(colorLayer, 0, 0);
}

function matchFillBackground(pixelPos, colorLayer, fillColor) {
  var r = colorLayer.data[pixelPos];
  var g = colorLayer.data[pixelPos+1];
  var b = colorLayer.data[pixelPos+2];

  for (var j=0;j<3;j++) {
    if ( (fillColor[j] == '1' && colorLayer.data[pixelPos+j] != 255) ||
         (fillColor[j] == '0' && colorLayer.data[pixelPos+j] != 0) ) {
      return true;
    }
  }
  return false;
}
