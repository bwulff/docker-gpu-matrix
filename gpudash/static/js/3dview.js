
var scene, camera, renderer;
var geometry, controls, zplane, xplane, yplane;
var image_plane_material;

var mainscreen = document.getElementById('content');
var ctrlcontainer = document.getElementById('controls-container');
var loadindicator = document.getElementById('load-indicator');

var comment_sprites_texture;
var comment_sprites_geomentry;
var comment_sprites_material;
var comment_sprites_particles;
var comments = [];
var commentURL = "/comments/" + config.volume.name + "/all/s_0.json";
// {
//   '1': {
//     x: 100,
//     y: 0,
//     z: 0,
//     user: 'Ben',
//     text: 'X = 100',
//     particle_index : 0,
//     box: false
//   },
//   '2' : {
//     x: 0,
//     y: 100,
//     z: 0,
//     user: 'Ben',
//     text: 'Y = 100',
//     particle_index : 1,
//     box: false
//   },
//   '3' : {
//     x: 0,
//     y: 0,
//     z: 100,
//     user: 'Ben',
//     text: 'Z = 100',
//     particle_index : 2,
//     box: false
//   }
// };

var raycaster;

var slices_to_load = 3;
var timeslice_dummy_tex = new THREE.TextureLoader().load(dummy_url('timeslice'), function(t) {
  slices_to_load -= 1;
  update_load_indicator();
});
var inline_dummy_tex = new THREE.TextureLoader().load(dummy_url('inline'), function(t) {
  slices_to_load -= 1;
  update_load_indicator();
});
var crossline_dummy_tex = new THREE.TextureLoader().load(dummy_url('crossline'), function(t) {
  slices_to_load -= 1;
  update_load_indicator();
});
update_load_indicator();

var next_color = 0;
var colornames = ['red','green','yellow','purple','blue','cyan'];
var colors = {
  red : '#ff0000',
  green : '#00ff00',
  blue : '#0000ff',
  yellow: '#ffff00',
  purple: '#ff00ff',
  cyan: '#00ffff'
}

var Aspect = function(index, name, color, coloring) {
    this.index = index;   // index of corresponding element in material array
    this.name = name;
    this.color = color;
    this.opacity = 0.0;
    this.coloring = coloring;
    this.timeslice = function() {
      window.location.href = config.baseURL + '/edit/' + config.volume.name + '/' + this.name + '/timeslice/' + state.timeslice;
    };
    this.inline = function() {
      window.location.href = config.baseURL + '/edit/' + config.volume.name + '/' + this.name + '/inline/' + state.inline;
    };
    this.crossline = function() {
      window.location.href = config.baseURL + '/edit/' + config.volume.name + '/' + this.name + '/crossline/' + state.crossline;
    };
    this.delete_annotation = function() {
      var name = prompt('Deleting an annotation from the database is IRREVERSIBLE!\n\nTo commence deletion of annotation enter the annotation name:');
      if (this.name == name) {
        if (confirm('Annotation ' + name + ' of volume ' + config.volume.name + ' will be deleted from the database.\n\nProceed?')) {
          var ajax = new XMLHttpRequest();
          ajax.open("DELETE", config.baseURL + '/volume/' + config.volume.name + '/' + name, false);
          ajax.onreadystatechange = function() {
              if (ajax.responseText == 'OK') {
                alert("Annotation successfully deleted from database.")
                window.location.reload(true);
              }
              console.log(ajax.responseText);
          }
          ajax.send();
        }
      }
    }
}

var Parameters = function() {
    this.timeslice = Math.floor( config.volume.depth / 2 );
    this.inline = Math.floor( config.volume.width / 2 );
    this.crossline = Math.floor( config.volume.height / 2 );
    this.comments = false;
    this.aspects = [];
    this.dragging = 0;
    this.add_annotation = function() {
      var name = prompt("Please enter the name for the new annotation:");
      name = name.replace(/ /g, '_');    // replace spaces with underscore
      name = name.replace(/\W/g, '');   // remove non-alphanumerical chars
      if (confirm("A new annotation named\n\n" + name + "\n\nwill be created in the database.\n\nProceed?")) {
        var ajax = new XMLHttpRequest();
        ajax.open("POST", config.baseURL + '/volume/' + config.volume.name + '/' + name, false);
        ajax.onreadystatechange = function() {
            if (ajax.responseText == 'OK') {
              alert("Annotation successfully created in database.")
              window.location.reload(true);
            }
            console.log(ajax.responseText);
        }
        ajax.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        ajax.send();
      }
    }
}
var state = new Parameters();       // current state
var uistate = new Parameters();     // user input

init();
animate();

function make_plane_material(filename) {
    slices_to_load += 1;
    var tex = new THREE.TextureLoader().load( filename , function(t) {
      slices_to_load -= 1;
      update_load_indicator();
    });
    update_load_indicator();
    tex.minFilter = THREE.LinearFilter
    var mat = new THREE.MeshLambertMaterial({ map : tex });
    mat.side = THREE.DoubleSide;
    mat.transparent=true;
    mat.opacity=1.0;
    return mat;
}

function make_annotation_material(tex, color) {
  tex.minFilter = THREE.LinearFilter
  var mat = new THREE.MeshLambertMaterial({
    side : THREE.DoubleSide,
    alphaMap : tex,
    color : color
  });
  mat.transparent=true;
  mat.opacity=0.0;
  return mat;
}


function init() {

    // set up scene
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
    camera.position.z = 700;

    // set up ambient light
    var light = new THREE.AmbientLight( 0xffffff ); // white light
    scene.add( light );

    // make materials
    var timeslice_materials = [];
    var inline_materials = [];
    var crossline_materials = [];

    var a = new Aspect(0, 'raw', '#ffffff', 'white');
    a.opacity = 1.0;
    state.aspects.push(a);
    a = new Aspect(0, 'raw', '#ffffff', 'white');
    a.opacity = 1.0;
    uistate.aspects.push(a);
    timeslice_materials.push(make_plane_material( slice_url('timeslice', 'raw', state.timeslice) ));
    inline_materials.push(make_plane_material( slice_url('inline', 'raw', state.inline) ));
    crossline_materials.push(make_plane_material( slice_url('crossline', 'raw', state.crossline) ));

    var i = 1
    for (j in config.volume.aspects) {
      var name = config.volume.aspects[j];
      if (name !== 'raw') {
        var color = colors[colornames[next_color]];
        if (next_color >= colornames.length) next_color = 0;
        console.log(color);
        state.aspects.push(new Aspect(i, name, color, colornames[next_color]));
        uistate.aspects.push(new Aspect(i++, name, color, colornames[next_color]));
        timeslice_materials.push(make_annotation_material( timeslice_dummy_tex, color ));
        inline_materials.push(make_annotation_material( inline_dummy_tex, color ));
        crossline_materials.push(make_annotation_material( crossline_dummy_tex, color ));
        next_color++
      }
    }

    // generate planes
    zplane = THREE.SceneUtils.createMultiMaterialObject( new THREE.PlaneGeometry( config.volume.width, config.volume.height ), timeslice_materials );
    zplane.rotation.x = -1*(Math.PI / 2);
    scene.add( zplane );

    xplane = THREE.SceneUtils.createMultiMaterialObject( new THREE.PlaneGeometry( config.volume.height, config.volume.depth ), inline_materials );
    xplane.rotation.y = -1*(Math.PI / 2);
    scene.add( xplane );

    yplane = THREE.SceneUtils.createMultiMaterialObject( new THREE.PlaneGeometry( config.volume.width, config.volume.depth ), crossline_materials );
    scene.add( yplane );

    // set up wireframe
    var whiteline = new THREE.LineBasicMaterial({
	       color: 0x424242
    });

    var half_width = config.volume.width/2;
    var half_height = config.volume.height/2;
    var half_depth = config.volume.depth/2;

    var geometry = new THREE.Geometry();
    geometry.vertices.push(
        new THREE.Vector3( 0-half_width, 0-half_depth,  half_height),
        new THREE.Vector3( 0-half_width, 0-half_depth,  0-half_height),
        new THREE.Vector3( half_width, 0-half_depth,  0-half_height),
        new THREE.Vector3( half_width, 0-half_depth,  half_height),
        new THREE.Vector3( 0-half_width, 0-half_depth,  half_height)
    );

    var groundplane = new THREE.Line( geometry, whiteline );
    scene.add( groundplane );

    // particle sprites -------------------
    var comment_sprites_texture = new THREE.TextureLoader().load("/static/img/comment.svg");
    //comment_sprites_texture.magFilter = THREE.NearestFilter;
    //comment_sprites_texture.minFilter = THREE.LinearMipMapLinearFilter;
    var comment_sprites_geomentry = new THREE.Geometry();

    // prepare comments
    var particle_index = 0;
    var ajax = new XMLHttpRequest();
    ajax.open("GET", commentURL, false);
    ajax.setRequestHeader('Content-Type', 'application/json');
    ajax.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        var data = JSON.parse(this.responseText);
        for (var key in data) {
          comment = data[key];

          // prepare comment box
          var box = createCommentBox(key, comment);
          comment.box = box;

          // prepare comment icon particle
          var vertex = new THREE.Vector3();
        	vertex.x = comment.x - config.volume.width/2;
        	vertex.y = -1 * (comment.z - config.volume.depth/2)
        	vertex.z = comment.y - config.volume.height/2;
        	comment_sprites_geomentry.vertices.push( vertex );
          comment.particle_index = particle_index++;
          console.log("Comment " + comment.particle_index + ": " + comment.text);

          comments.push(comment);
        }
      }
    }
    ajax.send(null);

    var comment_sprites_material = new THREE.PointsMaterial( { size: 15, map: comment_sprites_texture, blending: THREE.NormalBlending, depthTest: false, transparent: true } );
    comment_sprites_material.opacity = 0.0;
    var comment_sprites_particles = new THREE.Points(comment_sprites_geomentry, comment_sprites_material);

    scene.add(comment_sprites_particles);

    // set up renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth , window.innerHeight - 60 );
    mainscreen.appendChild( renderer.domElement );

    window.addEventListener( 'resize', onWindowResize, false );

    function onWindowResize(){
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize( window.innerWidth, window.innerHeight - 60 );
    }

    // set up orbit controls
    controls = new THREE.OrbitControls( camera, renderer.domElement );

    // set up controls
    var gui = new dat.GUI({ autoPlace: false });
    var ctlTimeSlice = gui.add(uistate, 'timeslice', 0, config.volume.depth).step(1);
    var ctlInlineSlice = gui.add(uistate, 'inline', 0, config.volume.width).step(1);
    var ctlCrosslineSlice = gui.add(uistate, 'crossline', 0, config.volume.height).step(1);
    var ctlComments = gui.add(uistate, 'comments');
    gui.add(uistate, 'add_annotation');
    for (i in uistate.aspects) {
      var aspect = uistate.aspects[i];
      var folder = gui.addFolder(aspect.name);
      var op_ctl = folder.add(aspect, 'opacity', 0.0, 1.0);
      op_ctl.onFinishChange(function(val) {
        sync_annotations('all');
      });
      if (aspect.name != 'raw') {
        folder.add(aspect, 'coloring', ['red','green','yellow','purple','blue','cyan']);
        var editfolder = folder.addFolder('edit');
        editfolder.add(aspect, 'timeslice');
        editfolder.add(aspect, 'inline');
        editfolder.add(aspect, 'crossline');
        editfolder.add(aspect, 'delete_annotation');
      }

    }
    ctrlcontainer.appendChild(gui.domElement);

    ctlComments.onChange(function(showComments) {
      if (showComments) {
        console.log("show comments");
        comment_sprites_particles.material.transparent = true ;
        comment_sprites_particles.material.opacity = 1.0;
      } else {
        console.log("hide comments");
        comment_sprites_particles.material.transparent = true ;
        comment_sprites_particles.material.opacity = 0.0;
      }
    });

    ctlTimeSlice.onChange(function(value) {
      uistate.dragging = 1;
    });

    ctlTimeSlice.onFinishChange(function(value) {
      state.dragging = 1;
      uistate.dragging = 0;
    });

    ctlInlineSlice.onChange(function(value) {
      uistate.dragging = 2;
    });

    ctlInlineSlice.onFinishChange(function(value) {
      state.dragging = 2;
      uistate.dragging = 0;
    });

    ctlCrosslineSlice.onChange(function(value) {
      uistate.dragging = 3;
    });

    ctlCrosslineSlice.onFinishChange(function(value) {
      state.dragging = 3;
      uistate.dragging = 0;
    });

    // click event handler toggeling comment boxes
    raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 20.0;
    raycaster.far = 20000;
    console.log("Raycaster.far=" + raycaster.far);
    var mouse = new THREE.Vector2();
    renderer.domElement.addEventListener("click", function(e) {
      // cast ray to see if mouse click hit a comment icon
      mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	    mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
      raycaster.setFromCamera( mouse, camera );
      var intersects = raycaster.intersectObject( comment_sprites_particles );
      if ( intersects.length > 0 ) {
        var screenx = e.pageX - renderer.domElement.offsetLeft;
        var screeny = e.pageY - renderer.domElement.offsetTop;
        var comment = getCommentForParticle(intersects[0].index);
        console.log("icon hit: comment " + comment.text);
        if (comment.box.style.display == 'none') {
          comment.box.style.left = (renderer.domElement.offsetLeft + screenx + 16) + 'px';
          comment.box.style.top = (renderer.domElement.offsetTop + screeny - 8) + 'px';
          comment.box.style.zIndex = 3;
          comment.box.style.display = 'block';
          if (comment.origin == 'timeslice') {
            uistate.timeslice = comment.z;
          } else if (comment.origin == 'inline') {
            uistate.inline = comment.y;
          } else if (comment.origin == 'crossline') {
            uistate.crossline = comment.y;
          }
        } else {
          comment.box.style.zIndex = -3;
          comment.box.style.display = 'none';
        }
      }
    });

    // hide all currently visible comment when user changes the view
    mainscreen.addEventListener("mousemove", function(e) {
      if (e.buttons != 0) {
        for (var key in comments) {
          if (comments.hasOwnProperty(key)) {
            var comment = comments[key];
            if (comment.box.style.display != 'none') {
              comment.box.style.display = 'none';
              comment.box.style.zIndex = -2;
            }
          }
        }
      }
    });

    sync_annotations("all");
}

function render() {
    renderer.render( scene, camera );
}

function animate() {
    requestAnimationFrame( animate );

    if ( state.timeslice != uistate.timeslice ) {
        var new_z = uistate.timeslice;
        zplane.position.y = -1 * (new_z - config.volume.depth / 2);
        state.timeslice = new_z;
    }

    if ( state.inline != uistate.inline ) {
        var new_x = uistate.inline;
        xplane.position.x = new_x - config.volume.width / 2;
        state.inline = new_x;
    }

    if ( state.crossline != uistate.crossline ) {
        var new_y = uistate.crossline;
        yplane.position.z = new_y - config.volume.height / 2;
        state.crossline = new_y;
    }

    // update opacity
    for (i in state.aspects) {
        if (state.aspects[i].opacity != uistate.aspects[i].opacity) {
            aspect = state.aspects[i];
            zplane.children[aspect.index].material.opacity = aspect.opacity;
            yplane.children[aspect.index].material.opacity = aspect.opacity;
            xplane.children[aspect.index].material.opacity = aspect.opacity;
            state.aspects[i].opacity = uistate.aspects[i].opacity
        }
    }

    // update color
    //zplane.children[aspect.index].material
    for (i in state.aspects) {
        if (state.aspects[i].coloring != uistate.aspects[i].coloring) {
            aspect = state.aspects[i];
            newcolor = colors[uistate.aspects[i].coloring];
            console.log("changing color of " + aspect.name + " to " + newcolor);
            zplane.children[aspect.index].material.color.setStyle(newcolor);
            zplane.children[aspect.index].material.needsUpdate = true;
            yplane.children[aspect.index].material.color.setStyle(newcolor);
            yplane.children[aspect.index].material.needsUpdate = true;
            xplane.children[aspect.index].material.color.setStyle(newcolor);
            xplane.children[aspect.index].material.needsUpdate = true;
            state.aspects[i].coloring = uistate.aspects[i].coloring;
        }
    }

    if (state.dragging == 0 && uistate.dragging > 0) {    // switch on drag mode
      switch (uistate.dragging) {
        case 1: // timeslice
          console.log("dragging time slice");
          // make plane 30% transparent
          zplane.children[0].material.opacity = 0.3;
          zplane.children[0].material.map = null;
          zplane.children[0].material.needsUpdate = true;
          // switch off aspects
          for (i in state.aspects) {
              if (i > 0) {
                  zplane.children[i].material.opacity = 0.0;
              }
          }
          break;
        case 2:
          console.log("dragging inline slice");
          // make plane 30% transparent
          xplane.children[0].material.opacity = 0.3;
          xplane.children[0].material.map = null;
          xplane.children[0].material.needsUpdate = true;
          // switch off aspects
          for (i in state.aspects) {
              if (i > 0) {
                  xplane.children[i].material.opacity = 0.0;
              }
          }
          break;
        case 3:
          console.log("dragging crossline slice");
          // make plane 30% transparent
          yplane.children[0].material.opacity = 0.3;
          yplane.children[0].material.map = null;
          yplane.children[0].material.needsUpdate = true;
          // switch off aspects
          for (i in state.aspects) {
              if (i > 0) {
                  yplane.children[i].material.opacity = 0.0;
              }
          }
          break;
        default: break;
      }
      state.dragging = uistate.dragging;
    }

    // switch off drag mode
    if (state.dragging > 0 && uistate.dragging == 0) {
      console.log("dragging off");
      switch (state.dragging) {
        case 1: // timeslice
          // update raw plane
          slices_to_load += 1;
          var tex = new THREE.TextureLoader().load( slice_url('timeslice', 'raw', uistate.timeslice), function(t) {
            slices_to_load -= 1;
            update_load_indicator();
          });
          update_load_indicator();
          update_texture( zplane, 0, tex );
          // update annotations
          sync_annotations('timeslice');
          // restore opacity from uistate
          for (i in state.aspects) {
              zplane.children[i].material.opacity = uistate.aspects[i].opacity;
          }
          break;
        case 2: // inine
          // update raw plane
          slices_to_load += 1;
          var tex = new THREE.TextureLoader().load( slice_url('inline', 'raw', uistate.inline), function(t) {
            slices_to_load -= 1;
            update_load_indicator();
          });
          update_load_indicator();
          update_texture( xplane, 0, tex );
          // update annotations
          sync_annotations('inline');
          // restore opacity from uistate
          for (i in state.aspects) {
              xplane.children[i].material.opacity = uistate.aspects[i].opacity;
          }
          break;
        case 3: // crossline
          // update raw plane
          slices_to_load += 1;
          var tex = new THREE.TextureLoader().load( slice_url('crossline', 'raw', uistate.crossline), function(t) {
            slices_to_load -= 1;
            update_load_indicator();
          });
          update_load_indicator();
          update_texture( yplane, 0, tex );
          // update annotations
          sync_annotations('crossline');
          // restore opacity from uistate
          for (i in state.aspects) {
              yplane.children[i].material.opacity = uistate.aspects[i].opacity;
          }
          break;
        default: break;
      }
      state.dragging = uistate.dragging;
    }

    render();
}

function update_load_indicator() {
  if (slices_to_load > 0) {
      loadindicator.innerHTML = slices_to_load + " to load...";
  } else {
      loadindicator.innerHTML = "all up-to-date";
  }
}

function sync_annotations(target) {
    if (target == 'timeslice' || target == 'all') {
      for (i in state.aspects) {
          var aspect = state.aspects[i];
          if ( i > 0 ) {
            if (aspect.opacity > 0.0) {
              slices_to_load += 1;
              var tex = new THREE.TextureLoader().load( slice_url('timeslice', aspect.name, uistate.timeslice), function(t) {
                slices_to_load -= 1;
                update_load_indicator();
              });
              update_load_indicator();
              update_annotation( zplane, i, tex);
            }
         }
      }
    }
    if (target == 'inline' || target == 'all') {
      for (i in state.aspects) {
        var aspect = state.aspects[i];
        if ( i > 0 ) {
          if (aspect.opacity > 0.0) {
            slices_to_load += 1;
            var tex = new THREE.TextureLoader().load( slice_url('inline', aspect.name, uistate.inline), function(t) {
              slices_to_load -= 1;
              update_load_indicator();
            } );
            update_load_indicator();
            update_annotation( xplane, i, tex);
          }
        }
      }
    }
    if (target == 'crossline' || target == 'all') {
      for (i in state.aspects) {
        var aspect = state.aspects[i];
        if ( i > 0 ) {
          if (aspect.opacity > 0.0) {
            slices_to_load += 1;
            var tex = new THREE.TextureLoader().load( slice_url('crossline', aspect.name, uistate.crossline), function(t) {
              slices_to_load -= 1;
              update_load_indicator();
            } );
            update_load_indicator();
            update_annotation( yplane, i, tex);
          }
        }
      }
    }
}

function update_texture(obj, index, tex) {
    console.log("update texture " + index);
    tex.minFilter = THREE.LinearFilter
    obj.children[index].material.map = tex;
    obj.children[index].material.needsUpdate = true;
}

function update_annotation(obj, index, alpha_map) {
    console.log("update annotation " + index);
    alpha_map.minFilter = THREE.LinearFilter;
    obj.children[index].material.alphaMap = alpha_map;
    obj.children[index].material.needsUpdate = true;
}

function slice_url(perspective, aspect, slice_num) {
    return config.baseURL + aspect + "/" + perspective + "/slice_" + slice_num + ".png";
}

function dummy_url(perspective) {
    return '/dummy/' + config.volume.name + "/dummy/" + perspective + ".png";
}

function createCommentBox(id, comment) {
  var temp = document.querySelector('#comment-template');
  var tempContainer = temp.content.querySelector('.comment-box');
  var tempUsername = temp.content.querySelector('.comment-username');
  var tempMessage = temp.content.querySelector('.comment-message');

  //prepare comment box
  tempUsername.innerHTML = comment.user + ':';
  tempMessage.innerHTML = comment.text;
  tempContainer.style.position = "absolute";
  tempContainer.style.display = 'none';   // hide icon
  tempContainer.style.zIndex = -1;        // and put behind canvas
  var commentId = 'comment-' + id
  tempContainer.setAttribute('id', commentId);
  var clone = document.importNode(temp.content, true);
  mainscreen.appendChild(clone);

  // 'manually' search for the newly create element because HTML5 is retarded
  for (var i=0; i<mainscreen.childNodes.length; i++) {
    if (mainscreen.childNodes[i].id == commentId) {
      return mainscreen.childNodes[i];
    }
  }
}

function getCommentForParticle(index) {
  for (var key in comments) {
    if (comments.hasOwnProperty(key)) {
      var comment = comments[key];
      if (comment.particle_index == index) {
        return comment;
      }
    }
  }
}
