let loaded_images = 0;
let num_images = 0;
function imgload() {
    loaded_images++;
    if (num_images !== 0 && loaded_images == num_images)
        init();
}

let canvas;
let canvas_rect;
let ctx;
let canvas_mask;
let canvas_mask_rect;
let ctx_mask;
let canvas_buffer;
let canvas_buffer_rect;
let ctx_buffer;
let data = {};
window.onload = function() {
    num_images = [...document.querySelectorAll("#images img")].length;

    if (num_images == loaded_images)
        init();
};

function init() {
    canvas = document.getElementById("canvas");
    canvas_rect = canvas.getBoundingClientRect();
    ctx = canvas.getContext("2d");

    canvas_mask = document.getElementById("canvasMask");
    canvas_mask_rect = canvas_mask.getBoundingClientRect();
    ctx_mask = canvas_mask.getContext("2d", { willReadFrequently: true });

    canvas_buffer = document.getElementById("canvasBuffer");
    canvas_buffer_rect = canvas_buffer.getBoundingClientRect();
    ctx_buffer = canvas_buffer.getContext("2d", { willReadFrequently: true });

    canvas.addEventListener('mousedown', canvas_mdown, false);
    canvas.addEventListener('mouseup', canvas_mup, false);
    canvas.addEventListener('mousemove', canvas_mmove, false);
    canvas.addEventListener('mouseleave', canvas_mleave, false);
    addEventListener("resize", (event) => {
        canvas_rect = canvas.getBoundingClientRect();
        canvas_mask_rect = canvas_mask.getBoundingClientRect();
        canvas_buffer_rect = canvas_buffer.getBoundingClientRect();
    });

    init_data();

    document.entities = entities;

    entities.push(data.japan);
    data.japan.alpha = 0;
    for (c of data.cities) {
        entities.push(c);
        c.alpha = 0;
        c.alpha_goal = 0;
    }

    setTimeout(() => {
        for (c of data.cities) {
            c.alpha_goal = 1;
        }
    }, 1000);

    var timer = setInterval(frame, 1000/60);
}

const States = Object.freeze({
    MAP:              Symbol('map'),
    TRANSITION:       Symbol('to_ekiben'),
    EKIBEN_COVERED:   Symbol('ekiben_covered'),
    EKIBEN:           Symbol('ekiben'),
});
let state = States.MAP;

let ekiben_city = null;
let ekiben_city_offset_x = 0;
let ekiben_city_offset_y = 0;
function to_ekiben(city) {
    if (state !== States.MAP)
        return;

    no_interaction = true;
    state = States.TRANSITION;
    cursor_default();

    ekiben_city = city;
    ekiben_city_offset_x = canvas.width/2 - city.x;
    ekiben_city_offset_y = canvas.height/2 - city.y;

    data.japan.set_pos_goal(data.japan.x + ekiben_city_offset_x, data.japan.y + ekiben_city_offset_y);
    for (let c of data.cities) {
        c.set_pos_goal(c.x + ekiben_city_offset_x, c.y + ekiben_city_offset_y);
    }

    setTimeout(() => {
        entities.push(data.shin);
        z_updated = true;
        data.shin.alpha = 0.0;
        data.shin.alpha_goal = 1.0
        data.shin.scale = 0.0;

        setTimeout(() => {
            for (let e of ekiben_city.ekiben_entities) {
                entities.push(e);
                e.y = -e.height/2;
                e.y_goal = canvas.height/2;
                e.x = e.x_goal = canvas.width/2;
                e.alpha = e.alpha_goal = 1;
            }
            z_updated = true;

            setTimeout(() => {
                state = States.EKIBEN_COVERED;
                no_interaction = false;
                document.getElementById('backButton').classList.remove('hidden');
            }, 500);
        }, 1500);
    }, 500);
}

function to_map() {
    if (state !== States.EKIBEN_COVERED && state !== States.EKIBEN)
        return;

    no_interaction = true;
    state = States.TRANSITION;
    cursor_default();

    document.getElementById('backButton').classList.add('hidden');
    data.shin.alpha_goal = 0;
    for (let e of ekiben_city.ekiben_entities) {
        e.y_goal = canvas.height + e.height/2;
    }
    for (let d of document.querySelectorAll("#ekibenBios div")) {
        d.classList.add("docked");
    }
    for (let d of document.querySelectorAll("#ekibenIngredients div")) {
        d.classList.add("docked");
    }

    setTimeout(() => {
        data.japan.set_pos_goal(data.japan.x - ekiben_city_offset_x, data.japan.y - ekiben_city_offset_y);
        for (let c of data.cities) {
            c.set_pos_goal(c.x - ekiben_city_offset_x, c.y - ekiben_city_offset_y);
        }
        ekiben_city.alpha_goal = 0.5;

        setTimeout(() => {
            delete_entity(data.shin.id);
            for (let e of ekiben_city.ekiben_entities) {
                if (e instanceof IngredientEntity)
                    e.lum = e.lum_goal = 100;
                else if (e instanceof MaskEntity)
                    e.unclick();

                delete_entity(e.id);
            }

            state = States.MAP;
            no_interaction = false;
            ekiben_city.unhover?.();
            ekiben_city = null;
            hovered_entity = null;
            grabbed_entity = null;
        }, 500);
    }, 1000);
}


let z_updated = true;
let no_interaction = false;
function frame() {
    sort_entities();
    update_entities();

    sort_entities();
    draw_entities();
}

function sort_entities() {
    if (!z_updated)
        return;
    z_updated = false;
    entities.sort((a, b) => b.z - a.z);
}

function delete_entity(id) {
    for (let i = 0; i < entities.length; ++i) {
        if (entities[i].id === id) {
            entities.splice(i, 1);
            return true;
        }
    }
    return false;
}

let entities = [];
let last_frame = Date.now();
function update_entities() {
    let curr_frame = Date.now();
    let tdelt = (curr_frame - last_frame) / 1000.0;
    for (let e of entities) {
        e.update(tdelt)
    }
    last_frame = curr_frame;
}

function draw_entities() {
    ctx.fillStyle = "#003c9e";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx_mask.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (let i = entities.length - 1; i >= 0; --i) {
        entities[i].draw()
    }
}

const MOUSE_CLICK_TIME = 150;
let mouse_down_index = 0;
let mouse_down_time = -1000000;
let mouse_down_x = 0;
let mouse_down_y = 0;
let mouse_down_entity = null;
function canvas_mdown(event) {
    if (no_interaction)
        return;

    mouse_down_time = Date.now();
    mouse_down_x = event.clientX - canvas_rect.left;
    mouse_down_y = event.clientY - canvas_rect.top;;
    canvas_mmove(event);
    mouse_down_entity = hovered_entity;
    if (mouse_down_entity?.grabbable) {
        setTimeout((i, e) => {
            if (i == mouse_down_index) {
                grab(mouse_down_entity);
            }
        }, MOUSE_CLICK_TIME, ++mouse_down_index, mouse_down_entity);
    }
}
function canvas_mup(event) {
    if (no_interaction)
        return;

    ++mouse_down_index;
    if (!mouse_down_entity)
        return;
    canvas_mmove(event);
    if (Date.now() - mouse_down_time <= MOUSE_CLICK_TIME) {
        if (hovered_entity === mouse_down_entity) {
            hovered_entity.click?.();
        }
    } else {
        ungrab();
    }
}

let mouse_x = 0;
let mouse_y = 0;
let hovered_entity = null;
document.log_mouse = false;
function canvas_mmove(event) {
    if (no_interaction)
        return;

    mouse_x = event.clientX - canvas_rect.left,
    mouse_y = event.clientY - canvas_rect.top;
    if (document.log_mouse)
        console.log(mouse_x, mouse_y);

    if (!grabbed_entity) {
        let e = get_top_element(mouse_x, mouse_y);
        if (e && e !== hovered_entity) {
            hovered_entity?.unhover?.();
            hovered_entity = e;
            if (!hovered_entity.hover?.()) {
                hovered_entity = null;
            } else if (hovered_entity.grabbable) {
                cursor_grab();
            } else if (hovered_entity.click) {
                cursor_pointer();
            }
        }
        if (hovered_entity === null)
            cursor_default();
    }
}

function canvas_mleave(event) {
    if (no_interaction)
        return;
    if (!hovered_entity)
        return

    hovered_entity.unhover?.();
    hovered_entity = null;
    ungrab();
}

// function canvas_click(event) {
//     var x = event.clientX - canvas_rect.left,
//         y = event.clientY - canvas_rect.top;

//     if (grabbed_entity)
//         ungrab();
//     else {
//         canvas_mmove(event);
//         let e = hovered_entity;
//         if (e && !e.click()) {
//             ungrab();
//         }
//     }
// }

function cursor_default() {
    canvas.style = "cursor: default;";
}
function cursor_pointer() {
    canvas.style = "cursor: pointer;";
}
function cursor_grab() {
    canvas.style = "cursor: grab;";
}
function cursor_grabbing() {
    canvas.style = "cursor: grabbing;";
}

function get_top_element(x, y, cond = (e) => true) {
    for (let e of entities) {
        if (cond(e) && e.is_hovering(x, y)) {
            return e;
        }
    };
    return null;
}

let grabbed_entity = null;
function grab(e) {
    if (grabbed_entity)
        return false;
    grabbed_entity = e;
    cursor_grabbing();
    return true;
}
function ungrab() {
    if (!grabbed_entity)
        return;
    grabbed_entity?.unclick?.();
    grabbed_entity = null;

    let e = get_top_element(mouse_x, mouse_y);
    if (e?.grabbable) {
        cursor_grab();
    } else if (e?.click) {
        cursor_pointer();
    } else {
        cursor_default();
    }
}


let entity_id_counter = 0;
const pos_snap = 0.5;
class Entity {
    id;

    x;
    y;
    z;

    x_goal;
    y_goal;
    pos_speed = 5;

    width;
    height;
    image;

    scale = 1.0;
    scale_goal = 1.0;
    scale_speed = 1.0;

    alpha = 1.0;
    alpha_goal = 1.0;
    alpha_speed = 1.0;

    constructor(x, y, z, image_id) {
        this.id = entity_id_counter++;
        this.x = this.x_goal = x;
        this.y = this.y_goal = y;
        this.z = z;
        this.image = document.getElementById(image_id);
        this.width = this.image.width;
        this.height = this.image.height;
    }

    set_pos(x, y) {
        this.x = this.x_goal = x;
        this.y = this.y_goal = y;
    }
    set_pos_goal(x, y) {
        this.x_goal = x;
        this.y_goal = y;
    }

    set_scale(a) {
        this.scale = a;
        this.scale_goal = a;
    }

    set_alpha(a) {
        this.alpha = a;
        this.alpha_goal = a;
    }

    update(tdelt) {
        if (Math.abs(this.x - this.x_goal) <= pos_snap)
            this.x = this.x_goal;
        else
            this.x = this.x + (this.x_goal - this.x) * (1.0/this.pos_speed);

        if (Math.abs(this.y - this.y_goal) <= pos_snap)
            this.y = this.y_goal;
        else
            this.y = this.y + (this.y_goal - this.y) * (1.0/this.pos_speed);

        if (this.alpha > this.alpha_goal) {
            this.alpha = Math.max(this.alpha_goal, this.alpha - this.alpha_speed * tdelt);
        } else if (this.alpha < this.alpha_goal) {
            this.alpha = Math.min(this.alpha_goal, this.alpha + this.alpha_speed * tdelt);
        }

        if (this.scale > this.scale_goal) {
            this.scale = Math.max(this.scale_goal, this.scale - this.scale_speed * tdelt);
        } else if (this.scale < this.scale_goal) {
            this.scale = Math.min(this.scale_goal, this.scale + this.scale_speed * tdelt);
        }
    }

    is_hovering(x, y) {
        const left = this.x - this.width/2;
        const top = this.y - this.height/2;
        return y > top && y < top + this.height
            && x > left && x < left + this.width;
    }

    draw() {
        ctx.globalAlpha = this.alpha;
        const w = this.image.width * this.scale;
        const h = this.image.height * this.scale;
        ctx.drawImage(this.image, this.x - w/2, this.y - h/2, w, h);
        ctx.globalAlpha = 1;
    }
}

class CityEntity extends Entity {
    name;
    ekiben_entities;

    constructor(x, y, z, name, ekiben_entities) {
        super(x, y, z, 'cityNormal');
        this.width = this.height = 20;
        this.name = name;
        this.ekiben_entities = ekiben_entities;
    }

    click() {
        to_ekiben(this);
    }

    hover() {
        if (state !== States.MAP)
            return false;
        this.image = document.getElementById('cityHover');
        let name_span = document.querySelector('#cityName span');
        name_span.textContent = this.name;
        name_span.classList.remove('hidden');
        return true;
    }
    unhover() {
        if (state !== States.MAP)
            return false;
        this.image = document.getElementById('cityNormal');
        let name_span = document.querySelector('#cityName span');
        name_span.classList.add('hidden');
    }
}

const lid_dist_thresh = 40000;
class LidEntity extends Entity {
    grabbable = true;

    x_orig;
    y_orig;

    bio;

    constructor(z, image_id, bio_id) {
        const x = canvas.width/2;
        const y = canvas.height/2;
        super(x, y, z, image_id);
        this.x_orig = x;
        this.y_orig = y;
        this.bio = document.getElementById(bio_id);
    }

    update(tdelt) {
        if (grabbed_entity === this) {
            this.x_goal = mouse_x;
            this.y_goal = mouse_y;

            let dist = (this.x - this.x_orig) * (this.x - this.x_orig)
                + (this.y - this.y_orig) * (this.y - this.y_orig);
            if (dist >= lid_dist_thresh) {
                ungrab();
                state = States.EKIBEN;
                this.alpha_goal = 0;
                this.bio.classList.remove('docked');
                setTimeout(() => delete_entity(this.id), 1500);
            }
        }

        super.update(tdelt);
    }

    hover() { return true; }

    // click() {
    //     if (grab(this)) {
    //         this.old_z = this.z;
    //         this.z = 1000000;
    //         z_updated = true;
    //         return true;
    //     }
    //     return false;
    // }

    unclick() {
        if (state !== States.EKIBEN_COVERED)
            return;
        let dist = (this.x - this.x_orig) * (this.x - this.x_orig)
            + (this.y - this.y_orig) * (this.y - this.y_orig);
        if (dist < lid_dist_thresh) {
            this.x_goal = this.x_orig;
            this.y_goal = this.y_orig;
        }
    }
}

class IngredientEntity extends Entity {
    lum = 100;
    lum_goal = 100;
    lum_speed = 100.0;

    constructor(z, image_id) {
        const x = canvas.width/2;
        const y = canvas.height/2;
        super(x, y, z, image_id);
    }

    update(tdelt) {
        if (this.lum > this.lum_goal) {
            this.lum = Math.max(this.lum_goal, this.lum - this.lum_speed * tdelt);
        } else if (this.lum < this.lum_goal) {
            this.lum = Math.min(this.lum_goal, this.lum + this.lum_speed * tdelt);
        }

        super.update(tdelt);
    }

    draw() {
        ctx_buffer.clearRect(0, 0, canvas.width, canvas.height);
        const w = this.image.width * this.scale;
        const h = this.image.height * this.scale;
        ctx_buffer.filter = `brightness(${this.lum}%)`
        ctx_buffer.drawImage(this.image, this.x - w/2, this.y - h/2, w, h);
        ctx.drawImage(canvas_buffer, 0, 0);
    }
}

const dim_lum = 60;
let active_mask = null;
class MaskEntity extends Entity {
    entity_i;
    value;
    ingredient;

    constructor(z, image_id, entity_i, value, ingredient_id) {
        const x = canvas.width/2;
        const y = canvas.height/2;
        super(x, y, z, image_id);
        this.entity_i = entity_i;
        this.value = value;
        this.ingredient = document.getElementById(ingredient_id);
    }

    is_hovering(x, y) {
        return ctx_mask.getImageData(x, y, 1, 1).data[0] === this.value;
    }

    hover() {
        if (state !== States.EKIBEN)
            return false;

        let es = ekiben_city.ekiben_entities;
        es[this.entity_i].lum_goal = 100;
        if (!active_mask) {
            for (let i=0; i < es.length; ++i) {
                if (i !== this.entity_i
                    && i !== active_mask?.entity_i
                    && es[i] instanceof IngredientEntity)
                {
                    es[i].lum_goal = dim_lum;
                }
            }
        }
        return true;
    }
    unhover() {
        let es = ekiben_city.ekiben_entities;
        if (active_mask) {
            if (active_mask !== this)
                es[this.entity_i].lum_goal = dim_lum;
            return;
        }
        for (let i=0; i < es.length; ++i) {
            if (es[i] instanceof IngredientEntity) {
                es[i].lum_goal = 100;
            }
        }
    }

    click() {
        if (active_mask !== this) {
            active_mask?.unclick();
            this.hover();
            active_mask = this;
            this.ingredient.classList.remove('docked');
        } else {
            this.unclick();
        }
        return true;
    }
    unclick() {
        if (active_mask === this) {
            active_mask = null;
            this.unhover();
            this.ingredient.classList.add('docked');
        }
    }

    draw() {
        const w = this.image.width * this.scale;
        const h = this.image.height * this.scale;
        ctx_mask.drawImage(this.image, this.x - w/2, this.y - h/2, w, h);
    }
}


function init_data() {
    data = {
        'japan': new Entity(canvas.width/2, canvas.height/2, 0, 'japan'),
        'shin':  new Entity(canvas.width/2, canvas.height/2, 1000, 'shin'),

        'cities': [
            new CityEntity(540, 312, 100, 'Yamagata', [
                new LidEntity(2200, 'beefDomannakaCover', 'beefDomannakaBio'),
                new IngredientEntity(2000, 'beefDomannaka'),
                new IngredientEntity(2010, 'beefDomannakaBeef'),
                new MaskEntity(2110, 'beefDomannakaBeefMask', 2, 50, 'beefDomannakaBeefBio'),
                new IngredientEntity(2020, 'beefDomannakaSides'),
                new MaskEntity(2120, 'beefDomannakaSidesMask', 4, 100, 'beefDomannakaSidesBio'),
            ]),
            new CityEntity(520, 390, 101, 'Tokyo', [
                new LidEntity(2200, 'makunouchiCover', 'makunouchiBio'),
                new IngredientEntity(2000, 'makunouchi'),
                new IngredientEntity(2010, 'makunouchiRice'),
                new MaskEntity(2110, 'makunouchiRiceMask', 2, 50, 'makunouchiRiceBio'),
                new IngredientEntity(2020, 'makunouchiSides'),
                new MaskEntity(2120, 'makunouchiSidesMask', 4, 100, 'makunouchiSidesBio'),
            ]),
            new CityEntity(400, 416, 102, 'Akashi', [
                new LidEntity(2200, 'hippariCover', 'hippariBio'),
                new IngredientEntity(2000, 'hippari'),
                new IngredientEntity(2010, 'hippariOcto'),
                new MaskEntity(2110, 'hippariOctoMask', 2, 50, 'hippariOctoBio'),
            ]),
        ],
    };

    // Adjustments
    shin.height = canvas.height;
}
