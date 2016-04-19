## Poaceae

(Fancy Latin speak for grass)

© 2016 by Mike Linkovich • www.spacejack.ca

---

## [Try the Demo!](http://www.spacejack.ca/projects/poaceae/)

`enter/return` toggles auto/manual camera control

`arrow keys` move forward/back and turn

`w` and `s` move up and down

---

### About

This experiment began as a question: Instead of relegating grass to being a second or third (or tenth) class citizen of a 3D scene, rendered as cheaply as possible as sprite billboards, what if you made it a first class citizen and spent the bulk of your rendering budget on modelling and animating each blade? What if you gave each blade a unique shape, antialiased edges, texture mapping, lighting and animation? What could that look like?

Which meant I'd need to:

* Rely on shaders as much as possible - the heavy lifting being done by a vertex shader in this case
* Only draw grass where the camera is looking

---

### Implementation

To make things a whole lot easier, I decided to rely on [array instancing](http://blog.tojicode.com/2013/07/webgl-instancing-with.html) which is pretty well-supported in hardware and browsers these days. This allowed me to create a single blade of grass mesh and use many instances of that, rather than trying to think about separate blades within a single mesh. Additionally, this frees us from having a 16 bit index buffer limit of 65535 indices per draw call.

The first thing I needed to tackle to make this thing work was to figure out a way to draw grass only within the view frustum (or at least to some acceptable degree.) There may be a way to only render blades of grass that fall within the view cone, but I couldn't think of anything exact and easy.

Instead I went with approximate and easy, which was to render a square patch of grass placed in front of the camera, centered at a point between the camera and the width of that square. Given the constraint that the viewer would never look straight down from a high altitude and was typically looking horizontally across the ground, this would hopefully suffice.

![frustum](img/frustum.png?raw=true)

(For reference, most of the relevant code for this discussion is in `grass.ts` if you want to follow along with the source handy.)

The easy thing about using an axis-aligned rectangular patch is that you can move that area around like a window, wrapping individual blades around when going out of bounds - not unlike repeating tiles in a platform scroller. It's not perfect, as you can see the far edges in the demo and a significant amount is wasted out of view, but it's not half bad either. *Most* of the work goes into rendering grass that actually appears on-screen and that was good enough for me.

So how to pack the data for each blade of grass? Using array instancing makes this pretty straightforward. A single blade of grass mesh, without any grass-like characteristics applied, could be thought of like this:

![grass mesh](img/blade-geometry.png?raw=true)

Basically a rectangle sliced into 4 segments, giving us 10 vertices. But we want to render both sides of each blade with different shading, so that adds up to a total of 20 vertices and 48 indices for a blade.

Interestingly however, since we want to vary each blade, it turns out that we don't actually need position coordinates, texture coordinates, normals or colours! In fact, all the vertex shader needs to know is the number of the vertex it's working on. I'll get back to this in a bit.

The things we do need, in order to make each blade unique, are each blade's offset position, the direction its facing (rotation about Z), a "leaning" amount and a "curve" amount. Because we're using array instancing, we can specify these values just once per instance (rather than redundantly for each vertex as we would have to without instancing.)

I used two vec4 attributes for these values. One for offset position and rotaion:

`{x:x, y:y, z:z, w:angle}`

and one for the blade characteristics:

`{x:width, y:height, z:lean, w:curve}`

Getting back to the point about not needing position, texture, etc. coordinates - if you take a look at the vertex shader script in `grass.ts`, you'll see that the `main` function starts off by looking at the `vindex` attribute, which contains the number of the vertex we're working with (0-19). So the first line:

`float vi = mod(vindex, BLADE_VERTS);`

figures out which vertex of "this" side of the blade we're working with (0-9). Then it goes on to figure out which vertical 'division' of the blade we're on, what percent height up the blade we are, what side and edge we're on.

Once we have those values, we can do things like scale by width and height of blade, taper the width by percent of height, skew by 'lean' amount and exponentially skew by height to get a curved shape.

Using the `time` uniform, we can apply an additional curve amount to animate each blade.

Then we can apply the rotation of the blade with a simple 2D rotation to the x & y coordinates.

Finally, we need to offset this blade's position to within a square that is in front of the camera. The x & y coordinates should always be a multiple of the size of the patch, this way they won't appear to "move" to the viewer.

Texture coordinates are easily calculated since we already have a value for edge (0 or 1) and a percent of the height of the blade.

For colour, I opted for some pretty simple hacks rather than using normals for full blown light calculations. I used the cosine of the blade angle clamped to a minimum light amount, additionally shaded by the height of the vertex. Not only does this give the appearance of a curved, lit shape, it also gives it a bit of an ambient occlusion effect. Some additional colour variation was done by using the blade xy position which is effectively 'random' when scaled up and passed through the `sin` function.

### Fading out gracefully

Now that we have a patch of animated grass that fills the foreground of the view frustum, it would be nice to do something about the obvious back edges of that patch that pop in as the camera moves. Originally I was going to use a simple fog perimeter to fade out the back edge of the grass patch, however this gives the scene an undesirable "foggy" look, when what I wanted was a sunny, summer afteroon.

To improve on this I used two types of fog, applied to both the grass and the textured ground plane. First we fade to a grass colour, so that the blades and ground blend into a common colour, obscuring the back edges of the square patch. Then I apply a more distant atmospheric fog to the scene which helps to give it some depth and reduce some of the busy noise of the overlapping blades.

You can see these simple fog calculations in both the `grass.ts` and `terrain.ts` fragment shaders.

### Finishing touches

I wanted more than just the lighting of the grass to suggest sunlight, I wanted an actual sun! So I added a sun to the skydome texture along with a radial gradient.

To achieve a glare effect when looking into the sun, I created a simple plane with a bright yellow-orange colour material to cover the entire screen. The opacity of this plane ranges from 0 to about 25%, depending on how directly the camera is pointed at the sun. Using additive blending, this blows out the bright colours, giving it a more... glaring effect. One other nice side effect is that it suggests the translucent nature of the grass blades without actually needing to make them transparent.

But what's the point of all of this without some nice camera work? `player.ts` contains the camera motion code for autoplay mode and manual control mode. Autoplay is pretty simple - here I abuse sin and cos for some twisty motion, smoothly oscillating rotation and bobbing up and down motion.

(Note that I have the X and Y axes along the ground with Z up, and the camera looking down the +X axis. I find things far easier to think about like this. See the camera setup code in `world.ts`)

For the manual camera, I treat the camera as a spring on its X and Y axes with spring-like resistance pushing it back toward the resting position and a strong friction value to prevent it from "bouncing" when released.

The further forward or back you pitch about the Y axis, the more forward or backward force (acceleration) is applied.

The further you roll left or right about the X axis, the more yaw force (acceleration) is applied.

And of course to keep us from flying and spinning away at infinite speeds, I use a friction value to keep positional and angular velocities smoothly in check.

---

## Install

Written in Typescript. Install the typescript compiler (tsc) globally with:

`$ npm install -g typescript`

To build grass.js from the .ts sources:

`$ tsc`

To compile automatically while editing .ts source files, use:

`$ tsc -w`

To build a production release `index.html` and `grass.min.js`:

`$ npm run build-prod`

This demo needs to be run in a local webserver. To install a simple http server:

`$ npm install -g http-server`

Start the server at the root of this project directory:

`$ http-server`

Then browse to http://address:port/dev.html

---

## License

This work is licensed under a Creative Commons Attribution-NonCommercial 4.0 International License:

http://creativecommons.org/licenses/by-nc/4.0/
