import {InputPort} from "./input-port";
import {OutputPort} from "./output-port";
import {Shape} from "./shape";
import {StepModel, WorkflowInputParameterModel, WorkflowOutputParameterModel} from "cwlts/models";
import Matrix = Snap.Matrix;

export type NodePosition = { x: number, y: number };

export class GraphNode extends Shape {


    public position: NodePosition = {x: 0, y: 0};

    protected paper: Snap.Paper;

    protected group;

    protected radius = 40;


    constructor(position: Partial<NodePosition>,
                private dataModel: WorkflowInputParameterModel | WorkflowOutputParameterModel | StepModel,
                paper: Snap.Paper) {

        super();

        this.paper = paper;

        this.dataModel = dataModel;

        Object.assign(this.position, position);
    }

    private makeIconFragment(model) {
        if (model instanceof StepModel) {

            if (model.run.class == "CommandLineTool") {

                return `
                    <g class="icon icon-tool">
                        <path d="M 0 10 h 15"></path>
                        <path d="M -10 10 L 0 0 L -10 -10"></path>
                    </g>
                `;

            } else if (model.run.class === "Workflow") {
                return `
                    <g class="icon icon-workflow">
                        <circle cx="-8" cy="10" r="3"></circle>
                        <circle cx="12" cy="0" r="3"></circle>
                        <circle cx="-8" cy="-10" r="3"></circle>
                        <line x1="-8" y1="10" x2="12" y2="0"></line>
                        <line x1="-8" y1="-10" x2="12" y2="0"></line>
                    </g>
                `;
            }
        }
        return "";
    }


    public makeTemplate(): string {

        let nodeTypeClass = "step";
        if (this.dataModel instanceof WorkflowInputParameterModel) {
            nodeTypeClass = "input";
        } else if (this.dataModel instanceof WorkflowOutputParameterModel) {
            nodeTypeClass = "output";
        }
        const iconTemplate = this.makeIconFragment(this.dataModel);

        const inputPortTemplates = (this.dataModel.in || [])
            .filter(p => p.isVisible)
            .sort((a, b) => -a.id.localeCompare(b.id))
            .map((p, i, arr) => GraphNode.makePortTemplate(
                p,
                "input",
                GraphNode.createPortMatrix(arr.length, i, this.radius, "input").toString()
            ))
            .reduce((acc, tpl) => acc + tpl, "");

        const outputPortTemplates = (this.dataModel.out || [])
            .filter(p => p.isVisible)
            .sort((a, b) => -a.id.localeCompare(b.id))
            .map((p, i, arr) => GraphNode.makePortTemplate(
                p,
                "output",
                GraphNode.createPortMatrix(arr.length, i, this.radius, "output").toString()
            ))
            .reduce((acc, tpl) => acc + tpl, "");

        const template = `
            <g class="node ${this.dataModel.id} ${nodeTypeClass}"
               transform="matrix(1, 0, 0, 1, ${this.position.x}, ${this.position.y})"
               data-id="${this.dataModel.id}">
        
                <g class="drag-handle" transform="matrix(1, 0, 0, 1, 0, 0)">
                    <circle cx="0" cy="0" r="${this.radius}" class="outer"></circle>
                    <circle cx="0" cy="0" r="${this.radius * .8}" class="inner"></circle>
                    ${iconTemplate}
                </g>
                <text x="0" y="${this.radius + 30}" class="label">${this.dataModel.label || this.dataModel.id}</text>
                ${inputPortTemplates}
                ${outputPortTemplates}
            </g>
        `;

        return template;
    }

    public draw(): Snap.Element {

        this.group.transform(new Snap.Matrix().translate(this.position.x, this.position.y));

        let iconFragment = ``;

        if (this.dataModel instanceof StepModel) {

            if (this.dataModel.run.class == "CommandLineTool") {

                iconFragment = `
                    <g class="icon icon-tool">
                        <path d="M 0 10 h 15"></path>
                        <path d="M -10 10 L 0 0 L -10 -10"></path>
                    </g>
                `;

            } else if (this.dataModel.run.class === "Workflow") {
                iconFragment = `
                    <g class="icon icon-workflow">
                        <circle cx="-8" cy="10" r="3"></circle>
                        <circle cx="12" cy="0" r="3"></circle>
                        <circle cx="-8" cy="-10" r="3"></circle>
                        <line x1="-8" y1="10" x2="12" y2="0"></line>
                        <line x1="-8" y1="-10" x2="12" y2="0"></line>
                    </g>
                `;
            }
        }

        this.group.add(Snap.parse(`
            <g class="drag-handle" transform="matrix(1, 0, 0, 1, 0, 0)">
                <circle cx="0" cy="0" r="${this.radius}" class="outer"></circle>
                <circle cx="0" cy="0" r="${this.radius * .8}" class="inner"></circle>
                ${iconFragment}
            </g>
            <text x="0" y="${this.radius + 30}" class="label">${this.dataModel.label || this.dataModel.id}</text>
        `));

        // this.attachEventListeners(this.circleGroup);

        return this.group;
    }

    private static makePortTemplate(port: OutputPort | InputPort, type: "input" | "output",
                                    transform = "matrix(1, 0, 0, 1, 0, 0)"): string {

        const portClass = type === "input" ? "input-port" : "output-port";
        const label = port.label || port.id;
        const template = `
            <g class="port ${portClass} ${port.id}" transform="${transform || 'matrix(1, 0, 0, 1, 0, 0)'}"
               data-connection-id="${port.connectionId}"
               data-port-id="${port.id}"
            >
                <g class="io-port ${port.id}">
                    <circle cx="0" cy="0" r="5" class="port-handle"></circle>
                </g>
                <text x="0" y="0" class="label unselectable">${label}</text>
            </g>
            
        `;

        return template;
    }

    public addPort(port: OutputPort | InputPort): void {

        const template = GraphNode.makePortTemplate(port);

        this.group.add(Snap.parse(template));

        // Ports should be sorted in reverse to comply with the SBG platform's coordinate positioning
        // portStore = portStore.sort((a, b) => -a.portModel.id.localeCompare(b.portModel.id));

        this.distributePorts();
        // if (portStore.length > 6 && portStore.length <= 20) {
        //
        //     const [a, b] = portStore.slice(-2).map(i => i.group.getBBox());
        //     const overlapping = a.y + a.height >= b.y;
        //     if (overlapping) {
        //         this.scale(1.08);
        //         this.distributePorts();
        //     }
        // }
    }

    /**
     * Moves the element to the outer edge of the node given an angle and the node radius
     * @param el Element to move
     * @param angle Angle along which the element should be moved
     * @param radius Radius of the parent node
     */
    private static movePortToOuterEdge(el: Snap.Element, angle: number, radius: number) {
        el // Remove previous transformations, bring it to the center
            .transform(new Snap.Matrix()
                // Then rotate it to a necessary degree
                    .rotate(angle, 0, 0)
                    // And translate it to the border of the circle
                    .translate(radius, 0)
                    // Then rotate it back
                    .rotate(-angle, 0, 0)
            );
    }

    /**
     * Repositions input and output ports to their designated places on the outer edge
     * of the node and scales the node in the process if necessary.
     */
    public distributePorts() {

        const outputs = Array.from(this.group.node.querySelectorAll(".output-port")).map(p => Snap(p));
        const inputs = Array.from(this.group.node.querySelectorAll(".input-port")).map(p => Snap(p));

        const availableAngle = 140;
        let rotationAngle;

        // Distribute output ports
        for (let i = 0; i < outputs.length; i++) {
            rotationAngle =
                // Starting rotation angle
                (-availableAngle / 2) +
                (
                    // Angular offset by element index
                    (i + 1)
                    // Angle between elements
                    * availableAngle / (outputs.length + 1)
                );

            GraphNode.movePortToOuterEdge(outputs[i], rotationAngle, this.radius);
        }

        // Distribute input ports
        for (let i = 0; i < inputs.length; i++) {
            rotationAngle =
                // Determines the starting rotation angle
                180 - (availableAngle / -2)
                // Determines the angular offset modifier for the current index
                - (i + 1)
                // Determines the angular offset
                * availableAngle / (inputs.length + 1);

            GraphNode.movePortToOuterEdge(inputs[i], rotationAngle, this.radius);
        }
    }

    public static createPortMatrix(totalPortLength: number,
                                   portIndex: number,
                                   radius: number,
                                   type: "input" | "output"): Snap.Matrix {
        const availableAngle = 140;

        let rotationAngle =
            // Starting rotation angle
            (-availableAngle / 2) +
            (
                // Angular offset by element index
                (portIndex + 1)
                // Angle between elements
                * availableAngle / (totalPortLength + 1)
            );

        if (type === "input") {
            rotationAngle =
                // Determines the starting rotation angle
                180 - (availableAngle / -2)
                // Determines the angular offset modifier for the current index
                - (portIndex + 1)
                // Determines the angular offset
                * availableAngle / (totalPortLength + 1);
        }

        return new Snap.Matrix()
            .rotate(rotationAngle, 0, 0)
            .translate(radius, 0)
            .rotate(-rotationAngle, 0, 0);
    }
}