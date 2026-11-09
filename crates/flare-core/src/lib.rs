use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Role {
    Button,
    Cell,
    Figure,
    Group,
    Img,
    Row,
    Table,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Geometry {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SemNode {
    pub role: Role,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub geometry: Option<Geometry>,
    pub focusable: bool,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub children: Vec<SemNode>,
}

impl SemNode {
    pub fn new(role: Role, label: impl Into<String>) -> Self {
        Self {
            role,
            label: label.into(),
            value: None,
            geometry: None,
            focusable: false,
            children: Vec::new(),
        }
    }

    pub fn with_value(mut self, value: impl Into<String>) -> Self {
        self.value = Some(value.into());
        self
    }

    pub fn with_geometry(mut self, x: f64, y: f64, w: f64, h: f64) -> Self {
        self.geometry = Some(Geometry { x, y, w, h });
        self
    }

    pub fn with_focusable(mut self, focusable: bool) -> Self {
        self.focusable = focusable;
        self
    }

    pub fn with_children(mut self, children: Vec<SemNode>) -> Self {
        self.children = children;
        self
    }
}

pub trait Describable {
    fn describe(&self) -> Vec<SemNode>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn semnode_builder() {
        let node = SemNode::new(Role::Button, "January")
            .with_value("1,234")
            .with_geometry(100.0, 50.0, 30.0, 200.0)
            .with_focusable(true);

        assert_eq!(node.role, Role::Button);
        assert_eq!(node.label, "January");
        assert_eq!(node.value.as_deref(), Some("1,234"));
        assert!(node.focusable);
        assert!(node.geometry.is_some());
    }

    #[test]
    fn semnode_serialises_to_json() {
        let node = SemNode::new(Role::Button, "Jan")
            .with_value("100")
            .with_geometry(10.0, 20.0, 30.0, 40.0)
            .with_focusable(true);

        let json = serde_json::to_string(&node).unwrap();
        assert!(json.contains("\"role\":\"button\""));
        assert!(json.contains("\"label\":\"Jan\""));
        assert!(json.contains("\"value\":\"100\""));
        assert!(json.contains("\"focusable\":true"));
    }

    #[test]
    fn semnode_skips_empty_fields() {
        let node = SemNode::new(Role::Figure, "Chart");
        let json = serde_json::to_string(&node).unwrap();
        assert!(!json.contains("value"));
        assert!(!json.contains("geometry"));
        assert!(!json.contains("children"));
    }

    #[test]
    fn semnode_with_children() {
        let bar = SemNode::new(Role::Button, "Jan")
            .with_value("100")
            .with_focusable(true);
        let group = SemNode::new(Role::Group, "Bars")
            .with_children(vec![bar]);

        assert_eq!(group.children.len(), 1);
        assert_eq!(group.children[0].label, "Jan");
    }

    #[test]
    fn roundtrip_json() {
        let node = SemNode::new(Role::Button, "Feb")
            .with_value("200")
            .with_geometry(5.0, 10.0, 15.0, 20.0)
            .with_focusable(true)
            .with_children(vec![SemNode::new(Role::Img, "icon")]);

        let json = serde_json::to_string(&node).unwrap();
        let parsed: SemNode = serde_json::from_str(&json).unwrap();
        assert_eq!(node, parsed);
    }
}
